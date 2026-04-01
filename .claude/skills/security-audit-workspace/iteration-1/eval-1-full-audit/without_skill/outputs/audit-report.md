# Security Audit Report: upiagent

**Date:** 2026-04-01
**Scope:** Full codebase review -- API routes, auth, credentials, payment flows, database, LLM integration
**Auditor:** Automated code review (Claude)

---

## Executive Summary

upiagent is a UPI payment gateway SaaS that verifies payments by reading Gmail bank alerts and parsing them with an LLM. The codebase shows evidence of security-conscious development (credential encryption, CSRF protection, RLS policies, prompt injection defenses). However, there are several **critical** and **high** severity issues that must be addressed before going live with real merchants and real money.

---

## CRITICAL Severity

### C1: LLM API Key Exposed in URL Query Parameter

**Files:**
- `/Users/amarpathak/upiagent/apps/dashboard/src/app/api/verify/route.ts` (line 269)
- `/Users/amarpathak/upiagent/apps/www/src/app/api/verify/route.ts` (line 294)

**Finding:** The Gemini API key is passed as a URL query parameter:
```
`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`
```
URL parameters are logged by proxies, CDNs, load balancers, browser history, and server access logs. This key (which could be the merchant's own key) is exposed in every request.

**Recommendation:** Use the `x-goog-api-key` HTTP header instead of URL query parameters for the Gemini API.

---

### C2: Merchant's `llm_api_key` Stored in Plaintext via Settings

**File:** `/Users/amarpathak/upiagent/apps/dashboard/src/app/dashboard/settings/actions.ts` (line 47)

**Finding:** The `updateMerchant` server action saves `llm_api_key` directly from formData without encrypting it:
```typescript
llm_api_key: (formData.get("llm_api_key") as string) || null,
```
While Gmail credentials are encrypted in the callback route, the LLM API key is stored in plaintext in Supabase. The `encrypt-credentials.ts` migration script includes `llm_api_key` in its `SENSITIVE_COLUMNS` list, but the settings action never encrypts on write.

**Recommendation:** Encrypt `llm_api_key` with `CREDENTIALS_ENCRYPTION_KEY` before saving, just like Gmail credentials are encrypted in `/api/gmail/callback`.

---

### C3: `www` Verify Endpoint Has No Authentication

**File:** `/Users/amarpathak/upiagent/apps/www/src/app/api/verify/route.ts`

**Finding:** The `POST /api/verify` endpoint on the `www` (marketing site) app has rate limiting but **zero authentication**. Any anonymous internet user can call this endpoint. It fetches the demo merchant's Gmail credentials from the database and uses them to scan Gmail. While the demo caps amount at 1-3, a determined attacker could:

1. Exhaust the Gemini API key quota
2. Trigger excessive Gmail API calls, potentially getting the OAuth token revoked
3. Probe the verification logic for timing/behavior differences

The per-IP rate limit (3/min) is easily bypassed with rotating proxies.

**Recommendation:** Add a CAPTCHA, session token, or at minimum a stricter global rate limit with IP reputation scoring. Consider disabling this endpoint entirely in production or requiring a short-lived session token from the demo page.

---

### C4: Hard-Coded Single-Bank Gmail Query

**Files:**
- `/Users/amarpathak/upiagent/apps/dashboard/src/app/api/verify/route.ts` (line 221)
- `/Users/amarpathak/upiagent/apps/www/src/app/api/verify/route.ts` (line 250)

**Finding:** The Gmail search query is hard-coded to `from:alerts@hdfcbank.bank.in`. This means:
1. Merchants using ANY bank other than HDFC will get zero verifications
2. This is a production blocker for multi-merchant deployment

**Recommendation:** Store the bank alert sender email per merchant in the database, or build a configurable list of known bank sender addresses per the `packages/core/src/gmail/client.ts` pattern (which already has `alerts@hdfcbank.net` and `alerts@hdfcbank.bank.in`).

---

## HIGH Severity

### H1: `Math.random()` Used for Transaction IDs in Dashboard

**File:** `/Users/amarpathak/upiagent/apps/dashboard/src/app/dashboard/create/actions.ts` (line 42)
**File:** `/Users/amarpathak/upiagent/apps/www/src/app/api/demo/route.ts` (line 18)

**Finding:** Transaction IDs in the dashboard create action and demo route use `Math.random()`:
```typescript
const txnId = `TXN_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
```
`Math.random()` is not cryptographically secure. The `packages/core/src/payment/intent.ts` module correctly uses `crypto.randomBytes()`, but the dashboard and demo routes do not use it.

**Recommendation:** Replace `Math.random()` with `crypto.randomBytes()` for transaction ID generation in both files, or import `generateTransactionId()` from `@upiagent/core`.

---

### H2: No Input Validation on Server Actions (Onboarding and Settings)

**Files:**
- `/Users/amarpathak/upiagent/apps/dashboard/src/app/onboarding/actions.ts`
- `/Users/amarpathak/upiagent/apps/dashboard/src/app/dashboard/settings/actions.ts`

**Finding:** The `createMerchant` and `updateMerchant` server actions cast formData directly to strings and pass them to Supabase without any validation or sanitization:
```typescript
const name = formData.get("name") as string;
const upiId = formData.get("upi_id") as string;
```
There is no Zod schema or any validation on:
- `upi_id` format (should match `xxx@yyy` pattern)
- `name` length limits
- `webhook_url` being a valid HTTPS URL
- `website_url` format
- `contact_email` being a valid email
- `contact_phone` format

A malicious merchant could store arbitrary strings, including extremely long values or strings containing HTML payloads. While Supabase parameterizes queries (preventing SQL injection), the lack of validation could lead to stored XSS if these values are rendered unsafely.

**Recommendation:** Add Zod validation schemas for all form inputs in server actions.

---

### H3: No Webhook Signing Implementation

**Files:**
- `/Users/amarpathak/upiagent/supabase/migrations/001_initial_schema.sql` (line 26: `webhook_secret text`)
- No webhook delivery code found

**Finding:** The database schema has a `webhook_secret` column and a `webhook_deliveries` table, but there is no implementation that actually sends webhooks or signs them with HMAC. When you implement webhook delivery, merchants will have no way to verify that webhook payloads actually came from upiagent.

**Recommendation:** Before going live, implement webhook delivery with HMAC-SHA256 signing using the `webhook_secret` per merchant. Each outgoing webhook should include a signature header (e.g., `X-UpiAgent-Signature`).

---

### H4: `www` Verify Page Uses Service Role Key with No Input Validation

**File:** `/Users/amarpathak/upiagent/apps/www/src/app/verify/[txn_id]/page.tsx` (line 29)

**Finding:** The public-facing verify page at `/verify/[txn_id]` creates a Supabase client with the service role key to fetch payment data:
```typescript
const supabase = createClient(supabaseUrl, supabaseServiceKey);
```
This is a Server Component so the key is never exposed to the browser. However, the `txn_id` parameter comes directly from the URL with no format validation. A malicious user could enumerate transaction IDs to discover payment details (amount, merchant name, status, bank name) for any merchant.

**Recommendation:** Add transaction ID format validation. Consider adding a short HMAC signature to the verify URL (e.g., `/verify/TXN_xxx?sig=abc123`) so only valid links work. Also restrict the `select` clause to only the fields needed for display.

---

### H5: Dashboard Verify Endpoint Missing Amount Upper Bound on Payment Creation

**File:** `/Users/amarpathak/upiagent/apps/dashboard/src/app/dashboard/create/actions.ts`

**Finding:** The `createPaymentAction` only checks `rawAmount > 0` with no upper bound. While `passesPostParseChecks` caps the LLM-extracted amount at 100,000, there is no cap on the amount a merchant can create a payment for.

**Recommendation:** Add maximum amount validation in `createPaymentAction` to match the 100,000 cap in post-parse checks.

---

### H6: In-Memory Dedup Lost on Serverless Cold Start

**Files:**
- `/Users/amarpathak/upiagent/apps/www/src/app/api/verify/route.ts` (lines 20-31, 37-70)
- `/Users/amarpathak/upiagent/packages/core/src/security/dedup.ts`

**Finding:** The demo verify route and the core `InMemoryDedupStore` use in-memory `Map` objects for deduplication and rate limiting. On Vercel (or any serverless platform), each function invocation may run in a separate container. The in-memory dedup store is effectively useless in production because:
1. Different requests may hit different instances
2. Cold starts reset all state

The same issue affects the in-memory rate limiter in the www verify route.

**Recommendation:** For production, replace in-memory stores with a persistent backend (Redis/Upstash, or a Supabase table with unique constraint on `upi_reference_id`). The dashboard verify route already records `verification_evidence` in the database, which partially mitigates this, but there is no unique constraint on `upi_reference_id` in the payments or evidence tables.

---

### H7: No CORS Configuration

**Files:**
- `/Users/amarpathak/upiagent/apps/dashboard/next.config.ts`
- `/Users/amarpathak/upiagent/apps/www/next.config.ts`

**Finding:** No CORS headers are configured anywhere. The API routes (especially `/api/verify` on www) can be called from any origin. Next.js does not add CORS headers by default, but if you plan to expose API routes for merchant integration (via API keys), you need explicit CORS configuration.

**Recommendation:** Add CORS headers to API routes, restricting origins as appropriate. For the dashboard, restrict to same-origin. For any public API endpoints, configure allowed origins explicitly.

---

## MEDIUM Severity

### M1: No Security Headers in Next.js Config

**Files:**
- `/Users/amarpathak/upiagent/apps/dashboard/next.config.ts`
- `/Users/amarpathak/upiagent/apps/www/next.config.ts`

**Finding:** Both Next.js configs are empty -- no `headers()` configuration. Missing headers include:
- `Content-Security-Policy`
- `X-Frame-Options` / `X-Content-Type-Options`
- `Strict-Transport-Security`
- `Referrer-Policy`
- `Permissions-Policy`

**Recommendation:** Add security headers via `next.config.ts` `headers()` or middleware. At minimum, set `X-Frame-Options: DENY` to prevent clickjacking of the dashboard.

---

### M2: Error Messages Leak Implementation Details

**Files:**
- `/Users/amarpathak/upiagent/apps/dashboard/src/app/api/verify/route.ts` (line 356)
- `/Users/amarpathak/upiagent/apps/www/src/app/api/verify/route.ts` (line 358)

**Finding:** Error responses include the raw error message:
```typescript
message: error instanceof Error ? error.message : "Gmail fetch error"
```
This can leak internal details (Gmail API error messages, Supabase errors) to clients.

**Recommendation:** Log the full error server-side but return generic error messages to clients.

---

### M3: No Middleware on `www` App

**Finding:** The `www` (marketing/demo) app has no middleware file at all. The dashboard has auth middleware via `proxy.ts`, but the www app has unprotected API routes (`/api/verify`, `/api/demo`). While the demo routes have rate limiting, there is no middleware layer for request filtering, logging, or IP blocking.

**Recommendation:** Add middleware to the `www` app for basic request filtering and security logging.

---

### M4: `setInterval` in Serverless Route

**File:** `/Users/amarpathak/upiagent/apps/www/src/app/api/verify/route.ts` (lines 62-70)

**Finding:** A `setInterval` runs every 5 minutes to clean up stale rate limit entries:
```typescript
setInterval(() => { ... }, 300_000);
```
In a serverless environment, this either (a) does nothing because the instance is already cold, or (b) keeps the instance warm unnecessarily, increasing costs.

**Recommendation:** Use lazy cleanup (as `InMemoryDedupStore` does) instead of `setInterval`, or move to a persistent store.

---

### M5: `clientSecret` Encryption Edge Case in Gmail Callback

**File:** `/Users/amarpathak/upiagent/apps/dashboard/src/app/api/gmail/callback/route.ts` (lines 126-128)

**Finding:**
```typescript
const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  ? encrypt(process.env.GOOGLE_CLIENT_SECRET, encryptionKey)
  : process.env.GOOGLE_CLIENT_SECRET;
```
If `GOOGLE_CLIENT_SECRET` is not set (falsy), it falls through to storing `undefined`. The ternary should fail hard rather than silently storing null/undefined.

**Recommendation:** Add an explicit check that `GOOGLE_CLIENT_SECRET` is set before proceeding with the OAuth callback.

---

## LOW Severity

### L1: `.env` Files Present in Working Directory

**Files:**
- `/Users/amarpathak/upiagent/.env` (contains real Gmail OAuth credentials in plaintext)
- `/Users/amarpathak/upiagent/apps/dashboard/.env.local` (contains Supabase service role key, encryption key, Gemini key, Google OAuth creds)
- `/Users/amarpathak/upiagent/apps/www/.env.local` (contains same service role key, Gemini key, Google OAuth creds)

**Finding:** These files are in `.gitignore` and NOT tracked by git (confirmed). However, the root `.env` file contains the raw Gmail refresh token -- the same credential that the system encrypts before storing in the database. Having plaintext credentials on disk is a residual risk.

**Recommendation:** Delete the root `.env` file if it is only needed for the legacy CLI setup flow. Consider using a secrets manager or `1Password CLI` for local dev.

---

### L2: Duplicate Code Between Dashboard and WWW Verify Routes

**Files:**
- `/Users/amarpathak/upiagent/apps/dashboard/src/app/api/verify/route.ts`
- `/Users/amarpathak/upiagent/apps/www/src/app/api/verify/route.ts`

**Finding:** These two files share approximately 80% identical code (LLM prompt, sanitization, email parsing, post-parse checks, Gemini API call). If a security fix is applied to one but not the other, it creates a vulnerability window.

**Recommendation:** Extract the shared verification logic into `@upiagent/core` and import it in both routes. This ensures security patches are applied in one place.

---

### L3: Gmail OAuth State Cookie Not Tied to User Session

**File:** `/Users/amarpathak/upiagent/apps/dashboard/src/app/api/gmail/connect/route.ts`

**Finding:** The CSRF state parameter is stored in a cookie but not tied to the authenticated user's session. An attacker who can set cookies on the domain (e.g., via a subdomain) could potentially inject their own state value.

**Recommendation:** Include the user ID in the state parameter or use a signed state token (e.g., HMAC of user_id + random nonce).

---

### L4: Supabase Anon Key Exposed as `NEXT_PUBLIC_`

**File:** `/Users/amarpathak/upiagent/apps/dashboard/.env.local`

**Finding:** This is standard Supabase practice -- the anon key is designed to be public and RLS policies protect data. However, ensure that RLS policies are tested thoroughly since any gap in RLS with a publicly known anon key means direct database access by any user.

**Recommendation:** Audit RLS policies with test cases. The existing policies look correct (user_id = auth.uid() pattern), but add integration tests that verify a user cannot access another user's merchants/payments/api_keys.

---

## Positive Security Observations

The following security measures are already well-implemented:

1. **Credential encryption at rest** -- AES-256-GCM with proper IV/auth tag handling (`packages/core/src/utils/crypto.ts`)
2. **OAuth CSRF protection** -- Random state parameter with HttpOnly cookie validation (`/api/gmail/connect` and `/api/gmail/callback`)
3. **RLS policies** -- Row-level security enabled on all tables with proper user_id scoping (`001_initial_schema.sql`)
4. **API key hashing** -- Keys stored as SHA-256 hashes, only prefix shown to users (`api-keys/actions.ts`)
5. **LLM prompt injection defenses** -- Input sanitization, delimiter-based prompting, post-parse sanity checks
6. **Auth on dashboard verify** -- User authentication and merchant ownership verification before any Gmail access
7. **UUID format validation** -- `paymentId` validated against UUID regex before database query
8. **Encryption enforcement** -- Gmail callback refuses to store credentials without encryption key set
9. **Gmail scope minimization** -- Only `gmail.readonly` scope requested (no send/modify)
10. **Payment expiry** -- Payments auto-expire after 5 minutes

---

## Priority Action Items (Pre-Launch Checklist)

| Priority | Issue | Effort |
|----------|-------|--------|
| 1 | C2: Encrypt `llm_api_key` on save in settings action | 30 min |
| 2 | C1: Move Gemini API key from URL param to header | 15 min |
| 3 | C4: Make bank alert sender configurable per merchant | 2-4 hrs |
| 4 | H1: Replace `Math.random()` with `crypto.randomBytes()` | 15 min |
| 5 | H2: Add Zod validation to all server actions | 1-2 hrs |
| 6 | H6: Replace in-memory dedup with persistent store | 2-3 hrs |
| 7 | C3: Add auth/CAPTCHA to www verify endpoint | 1-2 hrs |
| 8 | M1: Add security headers to both Next.js configs | 30 min |
| 9 | H4: Add format validation and HMAC sig to verify URLs | 1 hr |
| 10 | L2: Extract shared verify logic to `@upiagent/core` | 2-3 hrs |

---

*End of report. All findings are based on actual source code analysis. No mock data used.*

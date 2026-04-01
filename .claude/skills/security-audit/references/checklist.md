# Security Audit Checklist

Detailed items for each audit category. Check every item — mark as PASS, FAIL, or N/A with notes.

---

## 1. Authentication & Authorization

- [ ] Every API route checks authentication before processing (no anonymous access to protected data)
- [ ] Supabase `getUser()` is called (not just `getSession()` which can be spoofed client-side)
- [ ] Service role key is NEVER used in client components or browser-accessible code
- [ ] Service role key usage in API routes is justified (can't use RLS instead?)
- [ ] Middleware/proxy redirects unauthenticated users away from protected routes
- [ ] Auth check happens at the START of the handler, not after side effects
- [ ] Failed auth returns 401/403 — not 200 with an error message in the body
- [ ] No route relies solely on client-side auth checks (e.g., `useUser()` guarding a fetch)
- [ ] API keys (if used) are hashed before storage, compared with timing-safe equality
- [ ] Webhook endpoints verify signatures/shared secrets before processing

## 2. Credential & Secrets Management

- [ ] All sensitive credentials encrypted at rest (AES-256-GCM or equivalent)
- [ ] Encryption key stored in environment variable, not in code
- [ ] `.env`, `.env.local`, `.env*.local` are in `.gitignore`
- [ ] No secrets appear in `console.log`, error messages, or API responses
- [ ] No hardcoded API keys, tokens, or passwords anywhere in source
- [ ] Encryption function validates key length/format before use
- [ ] Decryption failures are logged but don't leak the ciphertext in error messages
- [ ] Key rotation plan exists (can re-encrypt all credentials without downtime)
- [ ] `NEXT_PUBLIC_*` variables contain only truly public values (no secrets)
- [ ] Git history doesn't contain previously committed secrets (check with `git log -p --all -S "secret_pattern"`)

## 3. Payment Integrity

- [ ] Payment amount is validated server-side (not just client-provided)
- [ ] Amount comparison uses exact match or defined tolerance (not floating-point `==`)
- [ ] UPI reference ID deduplication prevents replay of the same bank alert
- [ ] Dedup store survives restarts (or risk window is acceptable for in-memory)
- [ ] Time window for payment verification is bounded and configurable
- [ ] Race condition: two concurrent verify requests for the same payment can't both succeed
- [ ] Payment status transitions are enforced (pending → verified, never verified → pending)
- [ ] QR codes include unique transaction references (not reusable)
- [ ] Amount in QR matches amount in database (no client-side override possible)
- [ ] Webhook delivery to merchant is authenticated (signed or uses a secret)
- [ ] Demo endpoints are clearly separated and can't interact with production data

## 4. Input Validation & Injection

- [ ] All user-provided IDs validated as UUID format before database queries
- [ ] Amounts validated as positive numbers within acceptable range
- [ ] UPI IDs validated against expected format (`name@provider`)
- [ ] No string concatenation in SQL queries (use parameterized queries / Supabase client)
- [ ] HTML/script content in user inputs is sanitized before rendering
- [ ] URLs are validated before redirect (no open redirect via `redirect_uri` params)
- [ ] File uploads (if any) validate content type and size
- [ ] JSON request bodies are parsed with try/catch (malformed JSON doesn't crash)
- [ ] Query parameters and path segments are validated before use
- [ ] Error messages don't include raw user input (reflected XSS vector)

## 5. Prompt Injection

- [ ] Email content is sanitized before inclusion in LLM prompts
- [ ] Prompt uses delimiters to separate instructions from user/external data
- [ ] LLM is explicitly instructed to ignore instructions in email content
- [ ] LLM output is validated with a schema (Zod) — not trusted as-is
- [ ] Confidence threshold filters low-quality or manipulated extractions
- [ ] Email subject and body are length-truncated before LLM processing
- [ ] HTML entities and script tags stripped from email content
- [ ] Known jailbreak patterns are filtered (e.g., "ignore previous instructions")
- [ ] LLM temperature is 0 for extraction tasks (deterministic output)
- [ ] Extracted financial data (amount, UPI ref) is validated against expected formats post-extraction

## 6. OAuth & Token Security

- [ ] OAuth state parameter is generated with crypto-safe randomness
- [ ] State token is stored in httpOnly, secure, sameSite cookie
- [ ] State token has an expiry (< 15 minutes)
- [ ] Callback validates state token before exchanging code for tokens
- [ ] Redirect URI is hardcoded or validated against allowlist (no user-controlled redirect)
- [ ] Refresh tokens are encrypted before database storage
- [ ] Access tokens are not stored long-term (refresh on demand)
- [ ] OAuth scope is minimal (gmail.readonly, not full gmail access)
- [ ] Token exchange errors don't leak client_secret in error responses
- [ ] Revocation endpoint exists or is planned for user disconnect

## 7. Rate Limiting & DoS

- [ ] All public-facing endpoints have rate limits
- [ ] Rate limiting uses a reliable identifier (IP, API key, user ID — not just IP)
- [ ] Rate limit headers are returned (X-RateLimit-Remaining, Retry-After)
- [ ] Rate limit state survives across serverless instances (or risk is acceptable)
- [ ] Large request bodies are rejected early (before parsing)
- [ ] LLM calls have budget limits (token/cost caps per request)
- [ ] Gmail API calls are bounded (max messages fetched per verification)
- [ ] Cleanup of expired rate limit entries happens automatically
- [ ] Authenticated endpoints also have per-user rate limits
- [ ] Error responses under rate limiting don't leak internal state

## 8. Database Security

- [ ] RLS (Row-Level Security) is enabled on all tables with user data
- [ ] Every RLS policy correctly uses `auth.uid()` or equivalent
- [ ] No table has `USING (true)` RLS policy (grants access to all rows)
- [ ] Service role usage is minimized and justified with comments
- [ ] Migrations don't contain hardcoded data or secrets
- [ ] Indexes exist for common query patterns (prevent full table scans as DoS vector)
- [ ] `ON DELETE CASCADE` or equivalent handles orphaned records
- [ ] JSONB columns with user data are validated before insert
- [ ] No raw SQL construction — use the Supabase client or parameterized queries
- [ ] Database connection strings use SSL in production

## 9. Transport & Headers

- [ ] HTTPS is enforced in production (no HTTP fallback)
- [ ] `Strict-Transport-Security` header is set
- [ ] `Content-Security-Policy` is configured (at minimum, restricts script-src)
- [ ] `X-Frame-Options` or `frame-ancestors` prevents clickjacking
- [ ] `X-Content-Type-Options: nosniff` is set
- [ ] Cookies use `Secure`, `HttpOnly`, and `SameSite` flags appropriately
- [ ] CORS is configured restrictively (not `Access-Control-Allow-Origin: *` on API routes)
- [ ] API responses don't include `X-Powered-By` or framework version headers
- [ ] Sensitive API responses include `Cache-Control: no-store`
- [ ] WebSocket connections (if any) are authenticated

## 10. Dependency & Supply Chain

- [ ] `pnpm audit` / `npm audit` shows no high/critical vulnerabilities
- [ ] Lock file (`pnpm-lock.yaml`) is committed and reviewed in PRs
- [ ] No dependencies with known supply chain compromises
- [ ] Unused dependencies are removed (smaller attack surface)
- [ ] Dependencies are pinned to specific versions (no `*` or `latest`)
- [ ] Postinstall scripts in dependencies are reviewed
- [ ] No dependencies pull from non-registry sources (git URLs, tarballs)
- [ ] Core crypto operations use Node.js built-in `crypto`, not third-party libs
- [ ] TypeScript `strict` mode is enabled (catches null/undefined issues)
- [ ] Build output doesn't include source maps in production (leaks source code)

## 11. Security Code Effectiveness

- [ ] Every security validation function/helper that exists is actually called in the relevant code paths (not dead code)
- [ ] Middleware auth checks are applied to all intended routes (not just defined but bypassed by route structure)
- [ ] Input validation schemas (Zod, etc.) are actually used at API boundaries, not just defined
- [ ] Encryption/hashing utilities are called before data reaches the database (not just importable)
- [ ] Error-handling wrappers with security implications (rate limit, auth) are applied, not just available
- [ ] No route directly accesses raw request data when a validated/sanitized version should be used

## 12. Implicit Security Dependencies

- [ ] All assumptions about upstream security are documented (e.g., "we trust Gmail SPF/DKIM to verify sender")
- [ ] App does not silently depend on third-party email validation without verifying headers itself
- [ ] Reliance on Vercel/hosting platform security headers is explicit, not assumed
- [ ] Database-level constraints (unique, not null, check) back up application-level validation
- [ ] Trust in OAuth provider identity (Google, GitHub) is documented and scoped appropriately
- [ ] Any "security by obscurity" assumptions are identified (e.g., unguessable URLs as sole protection)

## 13. Cost Amplification & Resource Abuse

- [ ] LLM API calls cannot be triggered by unauthenticated or low-cost requests
- [ ] A single inbound request cannot fan out to unbounded external API calls (Gmail fetch, LLM, webhooks)
- [ ] Email fetching has a hard cap on messages processed per verification attempt
- [ ] LLM token usage has per-request and per-user budgets
- [ ] Webhook delivery retries are bounded (no infinite retry loops on failure)
- [ ] Large payload processing (email bodies, attachments) is bounded by size limits before expensive operations
- [ ] Demo/free-tier endpoints have stricter rate limits than authenticated production endpoints

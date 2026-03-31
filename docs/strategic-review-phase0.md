# Strategic Review — Phase 0 & Adjusted Phase 1

**Date:** 2026-04-01
**Source:** Product review feedback
**Priority:** CRITICAL — must be resolved before any external user touches this

---

## Phase 0: Security Redline (before deployment)

### 1. Encrypt Gmail tokens
Gmail refresh tokens in plaintext = database breach = every merchant's inbox compromised.
- Use Supabase Vault (pg_sodium) for encrypting: gmail_refresh_token, gmail_client_secret, llm_api_key
- Decrypt only at verification time, in-memory, never log

### 2. Clarify product positioning
upiagent is a **matching engine**, not a payment gateway.
- "Payment Detected" not "Payment Verified"
- Make clear: if detection fails, check your bank statement
- Dashboard should show: created → detected → confirmed states
- Webhook event: `payment.detected` not `payment.verified`

### 3. LLM fallback strategy
Free Gemini has rate limits. Five concurrent merchants = fifth one fails.
- Add regex fallback for common banks (HDFC, SBI, ICICI) in @upiagent/core
- LLM only when regex can't parse
- Track which path was used (regex vs LLM) in evidence

---

## Adjusted Phase 1: Launch Readiness

Priority order:

1. **Encrypt credentials** (Supabase Vault)
2. **Publish @upiagent/core to npm**
3. **Refactor dashboard to use @upiagent/core** (dogfood)
4. **Build public API routes** with rate limiting
5. **Fix payment expiry** (configurable, default 15 min)
6. **Logout + disconnect Gmail buttons**
7. **Usage tracking** (LLM calls per merchant)
8. **Webhook delivery** (with retry)
9. **Deploy to Vercel**
10. **Launch post**

# Rate Limiting Audit — Without Skill

**Only 1 out of 6 endpoints has rate limiting** — the www demo `/api/verify` endpoint (3/min per IP, 30/min global). Even that one has bypass vectors: the in-memory `Map` resets on cold starts in serverless, and `x-forwarded-for` can be spoofed on some deployments.

## Highest-risk unprotected endpoints

### 1. `/api/demo` (`apps/www/src/app/api/demo/route.ts`) — PUBLIC, no auth, no rate limit
Generates QR codes. Anyone can spam it freely.

### 2. `/api/verify` (`apps/dashboard/src/app/api/verify/route.ts`) — Auth-gated but NO rate limit
Each request triggers up to 5 Gmail API calls + 5 Gemini LLM calls. This is a cost amplification vector — one cheap HTTP request causes multiple expensive downstream calls.

### 3. `/api/gmail/connect` (`apps/dashboard/src/app/api/gmail/connect/route.ts`) — No rate limit
No self-contained auth check (relies solely on middleware redirect).

## On API key brute-force
The system does not currently use API keys for endpoint auth (it uses Supabase sessions), so there is no direct brute-force vector. However, the lack of rate limiting on verify endpoints means an attacker could cause excessive usage of the internally-stored Gemini API keys.

## Recommendations
- Add rate limiting to `/api/demo` and dashboard `/api/verify`
- Switch from in-memory Maps to distributed state (Upstash Redis)
- Use `x-real-ip` instead of `x-forwarded-for` for IP detection

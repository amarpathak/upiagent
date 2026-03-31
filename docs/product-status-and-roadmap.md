# upiagent — Product Status & Roadmap

**Last updated:** 2026-04-01
**Built by:** Amar Pathak
**Timeline:** Built in 1 day (March 31, 2026)

---

## What we have today

### Open-source npm package (`@upiagent/core`)
- UPI QR code generation with intent URLs
- `addPaisa` for unique amount matching (₹499 → ₹499.37)
- Gmail bank alert fetching via OAuth2
- LLM-powered email parsing (Gemini/OpenAI/Anthropic)
- 4-layer security pipeline (format, amount, time window, dedup)
- Structured logging, retry logic, cost tracking
- Custom error classes for programmatic handling
- CLI setup tool (`npx upiagent setup`)
- 49 unit tests passing
- TypeScript, ESM, full type declarations

### SaaS Dashboard (`apps/dashboard`)
- **Auth:** Supabase Auth (Google + email)
- **Onboarding:** Business name, UPI ID, bank account holder, contact
- **Gmail OAuth:** One-click "Connect Gmail" button (no manual credentials)
- **Create Payment:** QR generation with addPaisa, saved to DB
- **Payments List:** Searchable table with status badges, amounts, dates
- **Payment Detail:** QR, customer-facing preview, evidence breakdown, retry button
- **Auto-verification:** Polls Gmail + Gemini when payment is pending
- **Manual retry:** Force re-check with wider lookback for missed payments
- **Settings:** Merchant profile, Gmail connection, LLM config (free Gemini default), verification sources, webhook URL
- **API Keys:** Generate/delete, SHA-256 hashed, show-once pattern
- **Webhooks page:** Delivery log with status codes
- **Embed page:** Configurable widget code with copy button
- **Docs page:** Full API documentation with personalized code snippets
- **Operations page:** Verification rate, avg time, LLM usage, error log
- **Database:** Supabase Postgres with RLS, 5 tables, proper indexes

### Landing page (`apps/www`)
- Dark theme with neon accents
- Animated terminal hero showing payment flow
- Live demo: real QR generation + real Gmail verification
- Customer payment page preview with UPI name heads-up
- Code snippets, security layers, LLM vs regex comparison
- Cost comparison table (vs Razorpay)
- Indie hacker story section
- Public payment verify page (`/verify/TXN_xxx`)

### Infrastructure
- Turborepo monorepo (packages/core, apps/www, apps/dashboard)
- Supabase (Auth + Postgres + Storage)
- Gemini 2.5 Flash (free LLM for all merchants)
- pnpm workspaces
- Git with atomic commits

---

## What's NOT done yet

### Critical gaps
- [ ] **Public API routes** (`/api/v1/payments`) — API keys exist but no routes to use them
- [ ] **Webhook delivery** — webhook_url is saved but we never actually POST to it
- [ ] **Embed widget** — `embed.js` script doesn't exist yet (page just shows code)
- [ ] **Screenshot verification** — UI exists in settings but backend not built
- [ ] **Supabase Realtime** — replace polling with WebSocket for instant UI updates
- [ ] **Core package integration** — dashboard duplicates Gmail/LLM logic instead of using @upiagent/core

### UX issues
- [ ] Landing page demo polls but never verifies on other machines (LAN/HMR issues)
- [ ] No logout button in dashboard
- [ ] No "delete account" or "disconnect Gmail"
- [ ] Payment expiry is 5 minutes — too short, should be configurable
- [ ] No loading skeletons on dashboard pages
- [ ] No error boundaries
- [ ] No mobile responsive sidebar (hamburger menu)

### Security gaps
- [ ] Gmail credentials stored in plaintext in Supabase (should use Vault)
- [ ] No rate limiting on API routes
- [ ] No CSRF protection beyond what Next.js provides
- [ ] Service role key in .env.local (not encrypted)
- [ ] No audit log for sensitive operations

---

## Roadmap

### Phase 1: Ship MVP (this week)
**Goal:** Deploy to Vercel, get 10 beta users.

- [ ] Deploy www to Vercel (landing page)
- [ ] Deploy dashboard to Vercel
- [ ] Set up custom domain (upiagent.dev)
- [ ] Build public API routes (`POST /api/v1/payments`, `GET /api/v1/payments/:id`)
- [ ] Implement webhook delivery (POST to merchant URL on verification)
- [ ] Add logout button
- [ ] Fix payment expiry (make it configurable, default 10 min)
- [ ] Add Supabase Realtime for instant payment status updates
- [ ] Publish @upiagent/core to npm
- [ ] Write a launch post (Twitter/Reddit/IndieHackers)

### Phase 2: Polish (weeks 2-3)
**Goal:** Production-ready for small merchants.

- [ ] Build `embed.js` widget (iframe-based, works on any site)
- [ ] Screenshot verification (Gemini Vision for payment screenshots)
- [ ] Refactor dashboard to use @upiagent/core instead of duplicated code
- [ ] Mobile responsive sidebar
- [ ] Loading skeletons and error boundaries
- [ ] Rate limiting on all API routes
- [ ] Encrypt Gmail credentials with Supabase Vault
- [ ] Add Google verification for OAuth (remove "unsafe" warning)
- [ ] Usage tracking per merchant (LLM calls, verifications)
- [ ] Free tier limits (100 verifications/month)

### Phase 3: Scale (month 2)
**Goal:** Handle 100+ merchants, 1000+ verifications/day.

- [ ] Multi-bank support (SBI, ICICI, Axis email formats tested)
- [ ] SMS verification source (Twilio)
- [ ] WhatsApp verification source
- [ ] Virtual accounts integration (Cashfree/Decentro) for 1:1 matching
- [ ] Supabase Edge Functions for verification (instead of API routes)
- [ ] Dashboard analytics (charts, trends, peak hours)
- [ ] Team/org support (multiple users per merchant)
- [ ] Stripe billing integration (paid plans)

### Phase 4: Enterprise (month 3+)
**Goal:** Revenue, partnerships.

- [ ] UPI Collect API (requires RBI PA license — long-term)
- [ ] White-label solution (merchants embed under their own brand)
- [ ] Bulk payment creation (CSV upload)
- [ ] Reconciliation reports (daily/weekly PDF)
- [ ] SLA guarantees (99.9% uptime)
- [ ] SOC2 compliance (if targeting larger merchants)
- [ ] Partner with a bank for direct UPI integration

---

## Feature ideas (backlog)

### Verification improvements
- **Confidence dashboard** — show accuracy trends over time, which banks parse best
- **Multi-email support** — merchant connects multiple Gmail accounts
- **Custom bank patterns** — let merchants define which email senders to monitor
- **Verification webhooks** — real-time Supabase Realtime → Webhook bridge
- **Batch verification** — check multiple pending payments in one Gmail fetch

### Developer experience
- **SDK for React** — `<UpiPayment amount={499} />` component
- **SDK for Node.js** — `upiagent.payments.create()` (like Stripe SDK)
- **Postman collection** — importable API collection
- **Webhooks testing** — "Send test webhook" button in dashboard
- **Sandbox mode** — test payments without real money

### Business features
- **Payment links** — `upiagent.dev/pay/merchant/amount` sharable URLs
- **Invoice generation** — create invoices that include UPI QR
- **Recurring payments** — subscription-style repeated QR generation
- **Refund tracking** — detect refund emails, update payment status
- **Multi-currency** — support for USD/EUR via UPI international (future)

### Community & growth
- **Public API status page** — status.upiagent.dev
- **Changelog** — public changelog for updates
- **Discord/Telegram community** — for merchants and developers
- **Referral program** — merchants invite other merchants
- **Open-source contributors guide** — CONTRIBUTING.md, good first issues
- **YouTube demo video** — 5-min walkthrough

---

## Revenue model

### Free tier
- 100 verifications/month
- Gmail verification only
- Community support
- "Powered by upiagent" on payment page

### Pro (₹999/month or ~$12)
- Unlimited verifications
- Screenshot + SMS verification
- Webhook delivery
- Custom branding (no "Powered by")
- Email support

### Enterprise (custom)
- Virtual accounts (1:1 matching)
- SLA guarantees
- Dedicated support
- White-label
- Custom integrations

---

## Metrics to track

- Total merchants signed up
- Active merchants (created payment in last 7 days)
- Total payments created
- Verification success rate (overall, per bank, per source)
- Average verification time
- LLM token usage (cost)
- Gmail API quota usage
- Webhook delivery success rate
- Landing page → signup conversion rate
- Demo engagement (how many people generate a QR)

# upiagent SaaS Platform — Design Spec

**Date:** 2026-03-31
**Author:** Amar Pathak + Claude
**Status:** Draft

---

## 1. Overview

upiagent SaaS is a hosted UPI payment gateway that wraps the open-source `upiagent` npm package with auth, persistence, multi-source verification, a merchant dashboard, public APIs, webhooks, and an embeddable payment widget.

**Business model:** Free tier (limited verifications/month) + paid plans. Open-source package remains free; SaaS adds convenience, dashboard, multi-source verification, and managed infrastructure.

**One-liner:** "Accept UPI payments with a QR code. Verify automatically. No Razorpay."

---

## 2. Monorepo Structure

```
upiagent/
├── packages/
│   └── core/                ← open-source npm package (current src/)
│       ├── src/
│       ├── tests/
│       ├── package.json     ← "upiagent" on npm
│       └── tsup.config.ts
├── apps/
│   ├── www/                 ← landing page + public verify page (private)
│   │   └── src/app/
│   └── dashboard/           ← SaaS merchant dashboard + API (private)
│       └── src/app/
├── turbo.json               ← Turborepo config
├── package.json             ← workspace root
└── pnpm-workspace.yaml
```

**Why monorepo:** `dashboard` imports from `packages/core` directly. Changes to the core engine are immediately available in the SaaS without publishing to npm first.

---

## 3. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 16 (App Router) | Server components, API routes, Vercel deploy |
| Auth | Supabase Auth | Google + email, free 50K MAU, integrated with DB |
| Database | Supabase Postgres | Relational, RLS, real-time subscriptions |
| File Storage | Supabase Storage | Screenshot uploads |
| LLM | Gemini (default, free) | Multi-modal for screenshots, text for emails |
| Styling | Tailwind + shadcn/ui | Dark theme matching landing page |
| Monorepo | Turborepo | Build caching, parallel tasks |
| Package Manager | pnpm | Workspace support |

---

## 4. Database Schema

### `merchants` (extends Supabase Auth users)
```sql
create table merchants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  upi_id text not null,
  name text not null,

  -- Gmail credentials (encrypted at rest via Supabase Vault)
  gmail_client_id text,
  gmail_client_secret text,
  gmail_refresh_token text,

  -- LLM config
  llm_provider text default 'gemini',  -- gemini | openai | anthropic
  llm_api_key text,                     -- encrypted

  -- Verification sources (which are enabled)
  enabled_sources text[] default '{gmail}',  -- gmail, screenshot, sms, whatsapp

  -- Webhooks
  webhook_url text,
  webhook_secret text,  -- for HMAC signing

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### `api_keys`
```sql
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,
  key_hash text not null,        -- sha256 of full key
  key_prefix text not null,      -- "upi_ak_a1b2c3" for display
  name text default 'Default',
  last_used_at timestamptz,
  created_at timestamptz default now()
);
```

### `payments`
```sql
create table payments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,
  transaction_id text unique not null,  -- TXN_xxx (our ID)

  -- Payment request
  amount numeric(12,2) not null,
  amount_with_paisa numeric(12,2),      -- actual charged amount if addPaisa
  note text,
  intent_url text,
  qr_data_url text,

  -- Status
  status text default 'pending',  -- pending | verified | failed | expired
  expires_at timestamptz,

  -- Verification result (filled when verified)
  upi_reference_id text,
  sender_name text,
  sender_upi_id text,
  bank_name text,

  -- Multi-source verification
  verification_source text,      -- which source verified it: gmail | screenshot | ...
  overall_confidence numeric(3,2),  -- combined confidence 0.00-1.00

  -- Screenshot (if used)
  screenshot_url text,

  created_at timestamptz default now(),
  verified_at timestamptz
);
```

### `verification_evidence`
Each verification attempt from any source is recorded as evidence. A payment can have multiple evidence entries (e.g., Gmail found it AND screenshot matched).

```sql
create table verification_evidence (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references payments(id) on delete cascade,

  source text not null,           -- gmail | screenshot | sms | whatsapp | manual
  status text not null,           -- match | no_match | error
  confidence numeric(3,2),        -- 0.00-1.00 for this source

  -- Extracted data from this source
  extracted_amount numeric(12,2),
  extracted_upi_ref text,
  extracted_sender text,
  extracted_bank text,
  extracted_timestamp timestamptz,

  -- Raw context
  raw_data jsonb,                 -- email body, screenshot analysis, etc.

  -- Security layer results
  layer_results jsonb,            -- [{layer: "format", passed: true}, ...]

  created_at timestamptz default now()
);
```

### `webhook_deliveries`
```sql
create table webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references payments(id) on delete cascade,

  url text not null,
  method text default 'POST',
  request_body jsonb,
  status_code int,
  response_body text,

  attempt int default 1,
  delivered_at timestamptz,
  created_at timestamptz default now()
);
```

---

## 5. Verification Sources — Scoring System

Each source produces an evidence entry with a confidence score. The overall payment confidence is calculated from all evidence:

### Confidence calculation
```
overall_confidence = max(source_confidences)

If multiple sources agree (same amount + UPI ref):
  overall_confidence = min(1.0, highest_confidence + 0.1 * count_of_agreeing_sources)
```

### Source-specific scoring

**Gmail (confidence: 0.7–1.0)**
- 1.0 = all fields extracted clearly, bank alert from known sender
- 0.8 = amount + UPI ref found, some fields missing
- 0.7 = amount found but UPI ref unclear

**Screenshot (confidence: 0.5–0.9)**
- 0.9 = clear screenshot, all fields readable, UPI app recognized
- 0.7 = amount + ref visible but image quality low
- 0.5 = partial data extracted, low certainty

**SMS (future, confidence: 0.6–0.95)**
**WhatsApp (future, confidence: 0.6–0.95)**
**Manual (confidence: 1.0)** — merchant confirms, full trust

### Dashboard display
Each payment shows:
```
Payment #TXN_abc123 — ₹499.37 — VERIFIED (0.95)

Evidence:
  📧 Gmail     0.95  ✓  "₹499.37 from john@ybl ref:003538060093"
  📸 Screenshot 0.85  ✓  "₹499.37 PhonePe txn confirmed"

Security: [format ✓] [amount ✓] [time ✓] [dedup ✓]
```

---

## 6. Pages & Routes

### Public (unauthenticated)

| Route | Description |
|-------|------------|
| `/` | Landing page (existing) |
| `/login` | Supabase Auth login (Google + email) |
| `/signup` | Supabase Auth signup |
| `/verify/:txn_id` | Public payment status lookup |

**Public verify page shows:**
- Payment status (pending/verified/failed/expired)
- Amount
- Merchant name
- Timestamp
- Partial UPI ref (last 4 digits)
- Verification sources used (icons)

**Does NOT show:** sender details, merchant credentials, full UPI ref

### Dashboard (authenticated)

| Route | Description |
|-------|------------|
| `/dashboard` | Overview: today's stats, recent payments, system health |
| `/dashboard/payments` | Payment list — search, filter by status/date/amount |
| `/dashboard/payments/:id` | Payment detail — evidence breakdown, security layers |
| `/dashboard/create` | Create payment QR (interactive, like the demo) |
| `/dashboard/settings` | Merchant config: UPI ID, Gmail, LLM provider |
| `/dashboard/settings/sources` | Enable/disable verification sources, configure each |
| `/dashboard/api-keys` | Create/revoke API keys |
| `/dashboard/webhooks` | Webhook URL config + delivery log with retry |
| `/dashboard/embed` | Get embeddable widget code + preview |
| `/dashboard/ops` | System health: verification success rate, LLM token usage, latency, errors |

### Onboarding flow (first-time user)
```
Sign up → Set merchant name + UPI ID → Connect Gmail (OAuth) → Dashboard
```
Gmail connection uses the `setupGmailAuth` flow we already built. Screenshot verification requires no setup — just enable it.

---

## 7. API (for merchant backends)

Base URL: `https://upiagent.dev/api/v1`
Auth: `Authorization: Bearer upi_ak_...`

### `POST /api/v1/payments`
Create a payment request.
```json
// Request
{
  "amount": 499,
  "note": "Order #123",
  "addPaisa": true,
  "enabledSources": ["gmail", "screenshot"]  // optional override
}

// Response
{
  "id": "pay_abc123",
  "transactionId": "TXN_xxx",
  "amount": 499.37,
  "intentUrl": "upi://pay?...",
  "qrDataUrl": "data:image/png;base64,...",
  "status": "pending",
  "expiresAt": "2026-03-31T13:30:00Z",
  "verifyUrl": "https://upiagent.dev/verify/TXN_xxx",
  "screenshotUploadUrl": "https://upiagent.dev/api/v1/payments/pay_abc123/screenshot"
}
```

### `GET /api/v1/payments/:id`
Get payment status.
```json
{
  "id": "pay_abc123",
  "status": "verified",
  "amount": 499.37,
  "verifiedAt": "2026-03-31T13:25:00Z",
  "verification": {
    "source": "gmail",
    "confidence": 0.95,
    "upiReferenceId": "003538060093",
    "senderName": "JOHN DOE"
  },
  "evidence": [
    { "source": "gmail", "confidence": 0.95, "status": "match" },
    { "source": "screenshot", "confidence": 0.85, "status": "match" }
  ]
}
```

### `POST /api/v1/payments/:id/screenshot`
Upload payment screenshot for verification.
```
Content-Type: multipart/form-data
Body: file (image/png, image/jpeg)
```

### `GET /api/v1/payments`
List payments (paginated).
```
?status=verified&from=2026-03-01&to=2026-03-31&limit=20&offset=0
```

---

## 8. Webhook Payload

When a payment is verified, POST to merchant's webhook URL:

```json
{
  "event": "payment.verified",
  "timestamp": "2026-03-31T13:25:00Z",
  "data": {
    "id": "pay_abc123",
    "transactionId": "TXN_xxx",
    "amount": 499.37,
    "status": "verified",
    "upiReferenceId": "003538060093",
    "senderName": "JOHN DOE",
    "bankName": "HDFC Bank",
    "confidence": 0.95,
    "verificationSource": "gmail",
    "evidence": [
      { "source": "gmail", "confidence": 0.95 },
      { "source": "screenshot", "confidence": 0.85 }
    ]
  }
}
```

Headers:
```
X-UpiAgent-Signature: sha256=<HMAC of body using webhook_secret>
X-UpiAgent-Event: payment.verified
```

Retry: 3 attempts with exponential backoff (5s, 30s, 300s). Each attempt logged in `webhook_deliveries`.

---

## 9. Embeddable Widget

Merchants drop this on their checkout page:

```html
<script src="https://upiagent.dev/embed.js" defer></script>
<div
  data-upiagent
  data-merchant="mk_abc123"
  data-amount="499"
  data-note="Order #123"
  data-add-paisa="true"
  data-sources="gmail,screenshot"
  data-on-verified="onPaymentVerified"
></div>

<script>
function onPaymentVerified(payment) {
  console.log("Paid!", payment.upiReferenceId);
  // redirect to success page
}
</script>
```

The widget renders:
1. QR code + "Pay with UPI" button
2. Screenshot upload dropzone (if enabled)
3. Polling indicator
4. "Payment verified" confirmation

Isolated in an iframe or shadow DOM to avoid CSS conflicts.

---

## 10. Verification Pipeline (Backend)

```
Payment created (status: pending, expires in 3 min)
│
├── Gmail source (if enabled)
│   ├── Poll every 5s for 3 minutes
│   ├── Fetch bank alerts → LLM parse → security validate
│   └── Write to verification_evidence
│
├── Screenshot source (if enabled)
│   ├── Wait for upload via API
│   ├── Send to Gemini Vision → extract payment data
│   ├── Security validate
│   └── Write to verification_evidence
│
├── On ANY source match:
│   ├── Calculate overall_confidence from all evidence
│   ├── Update payment status → verified
│   ├── Fire webhook (async)
│   └── Notify via Supabase real-time (dashboard updates live)
│
└── On timeout (3 min, no match):
    └── Update payment status → expired
```

---

## 11. System Operations Page (`/dashboard/ops`)

**Metrics shown:**
- Verification success rate (last 1h / 24h / 7d)
- Average verification time (seconds from created → verified)
- LLM token usage (today, this week, cost estimate)
- Gmail API quota usage
- Webhook delivery success rate
- Active pending payments
- Error log (last 50 errors with stack traces)

**Per-source breakdown:**
- Gmail: emails fetched, parse success rate, avg confidence
- Screenshot: uploads received, parse success rate, avg confidence

---

## 12. Security Considerations

- Gmail credentials encrypted at rest (Supabase Vault)
- API keys stored as sha256 hashes, never plaintext
- Webhook payloads HMAC-signed
- Row-level security: merchants can only see their own data
- Screenshot uploads validated (file type, size < 5MB)
- Rate limiting on public verify page (prevent enumeration)
- No full UPI ref or sender details on public pages
- HTTPS only (Vercel enforces this)

---

## 13. Not in MVP (Future)

- SMS verification source (Twilio integration)
- WhatsApp verification source
- Manual verification (merchant confirms in dashboard)
- Team/org support (multiple users per merchant)
- Analytics charts (payment trends, peak hours)
- Payout tracking
- Mobile app
- Multi-currency (only INR for now)
- Bulk payment creation (CSV upload)

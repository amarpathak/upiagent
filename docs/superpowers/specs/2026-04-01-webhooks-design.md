# Webhook Notifications — Design Spec

**Date:** 2026-04-01
**Goal:** Replace frontend polling with background verification + webhook notifications. Demo and production merchants use the same webhook flow. No polling for Gmail+LLM calls anywhere.

---

## 1. Architecture

```
Payment Created (QR generated)
  → after() triggers background verification loop
  → Gmail fetch → LLM parse → security validation (retries over ~60s)
  → Write result to payments table
  → POST webhook to merchant's webhook_url (HMAC signed, retry with backoff)
```

One path for all merchants. Demo is just a merchant with `webhook_url` pointing at our own `/api/webhook/demo` endpoint.

### Demo Flow
1. `POST /api/demo` creates payment, returns QR to frontend
2. `after()` kicks off background verification (5s initial delay, then up to 6 attempts over ~60s)
3. On verification success/timeout, POST webhook to demo merchant's `webhook_url` (`/api/webhook/demo`)
4. `/api/webhook/demo` stores payload in short-lived memory map
5. Frontend polls `GET /api/webhook/demo?paymentId=xxx` every 2s — just a map lookup, zero cost
6. When found, frontend shows verified result

### Production Flow
1. Merchant creates payment via API
2. Background verification runs identically
3. On success/timeout, POST webhook to merchant's registered `webhook_url`
4. Merchant verifies HMAC signature and processes result

---

## 2. Webhook Payload

```typescript
// POST to merchant's webhook_url
// Headers:
//   Content-Type: application/json
//   X-UpiAgent-Signature: sha256=<HMAC-SHA256 of body using merchant's webhook_secret>
//   X-UpiAgent-Event: payment.verified | payment.expired
//   X-UpiAgent-Delivery-Id: <uuid>

{
  "event": "payment.verified",
  "timestamp": "2026-04-01T22:30:00Z",
  "deliveryId": "d_abc123",
  "data": {
    "paymentId": "pay_xyz",
    "amount": 499.37,
    "currency": "INR",
    "status": "verified",
    "upiReferenceId": "412345678901",
    "senderName": "John Doe",
    "confidence": 0.92,
    "verifiedAt": "2026-04-01T22:30:00Z"
  }
}
```

### Event Types

- `payment.verified` — payment confirmed via bank alert
- `payment.expired` — verification timed out (no matching bank alert found within window)

### Security

- `webhook_secret` — 32-byte hex, generated per merchant, stored in `merchants` table
- HMAC-SHA256 of raw JSON body using the merchant's secret
- Signature sent in `X-UpiAgent-Signature` header as `sha256=<hex>`
- Core library exports `verifyWebhookSignature(body, signature, secret): boolean` for merchants

### Retry

- 3 attempts with exponential backoff: 1s, 5s, 25s
- Retry only on network error or non-2xx response
- Same `deliveryId` on each retry — merchant deduplicates
- Delivery status tracked in `webhook_deliveries` table

---

## 3. Background Verification

Triggered via Next.js `after()` when a payment is created.

```
after(async () => {
  sleep(5s)  // initial delay for bank alert to arrive
  for (i = 0; i < 6; i++) {
    result = fetchAndVerifyPayment(...)
    if (result.verified) {
      updatePaymentInDb(paymentId, result)
      sendWebhook(merchant, paymentId, { event: "payment.verified", data: result })
      return
    }
    sleep(10s)  // wait between attempts
  }
  // Timeout after ~65s
  sendWebhook(merchant, paymentId, { event: "payment.expired" })
})
```

- Max 6 verification attempts over ~65 seconds
- Each attempt calls `fetchAndVerifyPayment()` from core (Gmail + LLM + security)
- On success: update DB + send webhook
- On timeout: send `payment.expired` webhook
- Runs in `after()` — does not block the response to the client

---

## 4. Demo Webhook Receiver

Internal endpoint that receives webhooks for the demo merchant.

### `POST /api/webhook/demo`
- Verifies HMAC signature using demo merchant's `webhook_secret`
- Stores payload in in-memory `Map<paymentId, payload>` with 5-minute TTL
- Returns 200

### `GET /api/webhook/demo?paymentId=xxx`
- Looks up paymentId in memory map
- Returns `{ received: true, payload }` or `{ received: false }`
- Frontend polls this every 2s — just a map read

---

## 5. Database Changes

### Merchants table — new columns
```sql
ALTER TABLE merchants ADD COLUMN webhook_url TEXT;
ALTER TABLE merchants ADD COLUMN webhook_secret TEXT;
```

### New table — webhook_deliveries
```sql
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id),
  payment_id UUID NOT NULL REFERENCES payments(id),
  event TEXT NOT NULL,
  delivery_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, delivered, failed
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  response_status INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_payment ON webhook_deliveries(payment_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
```

---

## 6. Core Library Changes

### New module: `packages/core/src/webhook/`

**`sender.ts`** — `WebhookSender` class
- `send(url, secret, payload): Promise<WebhookDeliveryResult>`
- HMAC-SHA256 signing
- Retry with exponential backoff (1s, 5s, 25s)
- Returns delivery result (success/failure, attempts, response status)

**`verify.ts`** — `verifyWebhookSignature(body, signature, secret): boolean`
- Helper for merchants to verify incoming webhooks
- Constant-time comparison to prevent timing attacks

**`types.ts`** — Types
- `WebhookEvent` = `"payment.verified" | "payment.expired"`
- `WebhookPayload` = `{ event, timestamp, deliveryId, data }`
- `WebhookDeliveryResult` = `{ delivered, attempts, responseStatus? }`

**`index.ts`** — Re-exports

### Updated exports in `src/index.ts`
```typescript
export { WebhookSender, verifyWebhookSignature } from "./webhook/index.js";
export type { WebhookPayload, WebhookEvent, WebhookDeliveryResult } from "./webhook/index.js";
```

---

## 7. App File Changes

### WWW app
| Action | File | Description |
|--------|------|-------------|
| **New** | `api/webhook/demo/route.ts` | POST: receive webhook, store in memory. GET: check status. |
| **Modify** | `api/demo/route.ts` | Add `after()` for background verification + webhook send |
| **Modify** | `api/verify/route.ts` | Becomes internal — called from background loop, not frontend |
| **Modify** | `components/live-demo.tsx` | Replace setInterval Gmail+LLM polling with lightweight webhook status polling |

### Dashboard app
| Action | File | Description |
|--------|------|-------------|
| **Modify** | `api/verify/route.ts` | Add `after()` pattern, send webhook after verification |

### Database
| Action | File |
|--------|------|
| **New** | `supabase/migrations/004_webhooks.sql` |

---

## 8. Non-Goals

- Gmail push notifications (Google Pub/Sub) — future work
- WebSocket transport — overkill, webhook + lightweight polling is sufficient
- Webhook management UI in dashboard — future work (for now, set via DB/API)
- Webhook retry queue (persistent) — in-memory retry is fine for v1

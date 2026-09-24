# upiagent REST API reference

**Base URL:** `https://beta.upiagent.live`
**Auth:** `Authorization: Bearer upi_ak_…` on every request. Create keys in
[Dashboard → API Keys](https://beta-dashboard.upiagent.live/dashboard/api-keys).
**Format:** JSON in and out. Every error is `{ "error": "…" }` with an HTTP status.

Request and response shapes are defined once as Zod schemas in
`src/contracts` (published as `upiagent/contracts`). The routes
validate against them and the SDK parses responses with them, so this page,
the API and the SDK describe the same thing.

- [Payment lifecycle](#payment-lifecycle)
- [Payments](#payments): create, list, get, verify, cancel
- [Screenshot proof](#screenshot-proof)
- [Evidence](#evidence)
- [Usage](#usage)
- [Webhooks](#webhooks)
- [Limits](#limits)
- [Errors](#errors)

---

## Payment lifecycle

```
pending ──screenshot proof──> claimed ──bank evidence──> verified
   │                                                         ▲
   └───────────────────bank evidence─────────────────────────┘
pending ──20 min──> expired        pending ──cancel──> cancelled
```

| Status | Meaning | Release goods? |
|---|---|---|
| `pending` | Created, not paid yet | No |
| `claimed` | Customer's screenshot passed every check: success status, exact amount, paid **to you**, paid after the request was created, UTR never used, image never submitted before | Low-value goods |
| `verified` | Confirmed by your bank: a bank alert in your inbox (or the Android app) carries the payment — for a claimed payment, the screenshot's **exact UTR and amount** | Anything |
| `expired` | Not paid within 20 minutes | No |
| `cancelled` | Cancelled while pending | No |

A well-forged screenshot can pass the `claimed` checks; `verified` exists
because bank evidence cannot be forged from the customer's side. A `claimed`
payment becomes `verified` only when a bank alert from a known bank sender
(DKIM/DMARC-authenticated, received after the payment was created) contains
the screenshot's UTR and the exact amount. That happens the moment the alert
arrives (Gmail push) — nothing polls.

### Verification modes

Set per merchant in Dashboard → Settings:

| Mode | Pending payment is verified by | Incoming bank mail costs |
|---|---|---|
| `screenshot` | the customer's screenshot, then its UTR in your bank alert | nothing — exact UTR matching, no LLM |
| `auto` (default) | a bank alert with the exact amount (use `addPaisa`), or a screenshot as above | ≤ 1 LLM extraction per new bank email |

---

## Payments

### Create a payment — `POST /api/v1/payments`

```bash
curl -X POST https://beta.upiagent.live/api/v1/payments \
  -H "Authorization: Bearer $UPIAGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "amount": 499, "note": "Order #123", "addPaisa": true }'
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `amount` | number | yes | Rupees, 1 – 100,000 |
| `note` | string | no | Shown in the customer's UPI app; ≤ 500 chars |
| `addPaisa` | boolean | no | Adds random paise (499 → 499.37) so concurrent payments can be told apart. Recommended. |

**201 Created**

```json
{
  "id": "8f5b8f0e-5d4a-4b8e-9a51-2a3c4d5e6f70",
  "transactionId": "TXN_a1b2c3_m4x7k2",
  "amount": 499.37,
  "intentUrl": "upi://pay?pa=shop@ybl&am=499.37&...",
  "qrDataUrl": "data:image/png;base64,...",
  "status": "pending",
  "expiresAt": "2026-09-24T18:20:00.000Z",
  "createdAt": "2026-09-24T18:00:00.000Z"
}
```

`amount` is what the customer must pay, including added paise. Show
`qrDataUrl` as an image, or open `intentUrl` on mobile.

### List payments — `GET /api/v1/payments`

| Query | Notes |
|---|---|
| `status` | `pending` · `claimed` · `verified` · `expired` · `cancelled` |
| `since` | ISO 8601; payments created at or after it |
| `limit` | 1 – 50, default 20 |
| `cursor` | `nextCursor` from the previous page |

```json
{ "payments": [ /* Payment, newest first */ ], "hasMore": true, "nextCursor": "MjAyNi0wOS0yNFQx..." }
```

### Get a payment — `GET /api/v1/payments/:id`

Returns a **Payment**. Reading a pending payment past its deadline marks it
`expired`.

```json
{
  "id": "8f5b8f0e-…",
  "transactionId": "TXN_a1b2c3_m4x7k2",
  "amount": 499.37,
  "note": "Order #123",
  "status": "verified",
  "intentUrl": "upi://pay?…",
  "qrDataUrl": "data:image/png;base64,…",
  "expiresAt": "2026-09-24T18:20:00.000Z",
  "createdAt": "2026-09-24T18:00:00.000Z",
  "upiReferenceId": "412345678901",
  "senderName": "R***a",
  "senderUpiId": "***@ybl",
  "bankName": "HDFC Bank",
  "confidence": 0.95,
  "claimedAt": null,
  "verifiedAt": "2026-09-24T18:03:12.000Z"
}
```

`upiReferenceId`, `senderName`, `senderUpiId`, `bankName`, `confidence`,
`claimedAt` and `verifiedAt` appear once the payment is `claimed` or
`verified`. Nullable fields may be `null`.

### Check now — `POST /api/v1/payments/:id`

One inbox check right now, for a "check again" button. Never call it on a
timer: Gmail push and the Android app verify automatically.

- **claimed** → one Gmail search for the screenshot's exact UTR. No LLM
  unless a trusted bank email's text can't be read deterministically.
- **pending**, `auto` mode → amount match over recent bank alerts (spends
  LLM tokens).
- **pending**, `screenshot` mode → nothing to check; returns a message
  asking for the screenshot.

```json
{ "verified": true, "status": "verified", "payment": { "amount": 499.37, "upiReferenceId": "412345678901", "senderName": "R***a", "bankName": "HDFC Bank", "confidence": 0.95 } }
```

```json
{ "verified": false, "status": "claimed", "message": "No bank email containing UTR 412345678901 yet." }
```

### Cancel a payment — `DELETE /api/v1/payments/:id`

Cancels a **pending** payment and returns it. `409` if it is already
claimed, verified, expired or cancelled.

---

## Screenshot proof

### `POST /api/v1/payments/:id/proof`

Submit the customer's UPI payment screenshot — the manual-verification
endpoint (the MCP tool `upiagent_submit_payment_proof` does the same). One
vision model call reads it; deterministic checks then decide. A pass moves
the payment to `claimed`, and its UTR is immediately looked up in your bank
alerts: if the alert is already there the response says `verified`,
otherwise the payment turns `verified` when the alert arrives.

The original image is stored as evidence (private storage, see
[Evidence](#evidence)) whether or not it is accepted.

```bash
curl -X POST https://beta.upiagent.live/api/v1/payments/$ID/proof \
  -H "Authorization: Bearer $UPIAGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"data:image/png;base64,$(base64 -w0 screenshot.png)\"}"
```

| Field | Type | Notes |
|---|---|---|
| `image` | string | Base64, or a `data:` URL. PNG, JPEG or WebP, max 3 MB decoded |
| `mediaType` | string | Required when `image` is bare base64 |

```json
{
  "accepted": true,
  "status": "claimed",
  "utr": "412345678901",
  "confidence": 0.92,
  "reasons": [
    "UTR 412345678901 read.",
    "Amount ₹499.37 matches.",
    "Payee UPI ID matches the merchant.",
    "Payment time is inside the request window.",
    "Not yet confirmed by the bank: No bank email containing UTR 412345678901 yet."
  ]
}
```

**`accepted: false` means do not deliver the goods.** `reasons` says why,
e.g. `"Paid to someone@ybl, not this merchant."`,
`"Amount ₹499 does not match the requested ₹499.37."`,
`"UTR … was already used for another payment (replay)."`.

Checks, in order: it is a UPI payment confirmation · legible · status
success · 12-digit UTR · amount equal to the paisa · payee UPI ID is yours
(when visible) · paid no earlier than the request was created · UTR and image
never used before. If payee or time is not visible the proof can still pass,
at lower confidence.

Submitting proof for a payment that is already `claimed`/`verified` returns
its current state without a model call. The daily token cap is checked
**before** the vision call. Success triggers `payment.claimed`, and
`payment.verified` once the bank alert matches.

---

## Evidence

### `GET /api/v1/payments/:id/evidence`

Which sources matched and with what confidence, newest first (max 20).
Never includes raw email content. Screenshot evidence carries `imageUrl`, a
signed link to the original image that expires after 5 minutes (fetch the
evidence again for a fresh one).

```json
{
  "evidence": [
    { "source": "gmail", "status": "match", "confidence": 1, "createdAt": "2026-09-24T18:03:12.000Z", "utr": "412345678901",
      "reasons": ["Bank sender alerts@hdfcbank.net, dkim pass.", "Contains UTR 412345678901.", "Credit of exactly ₹499.37."] },
    { "source": "screenshot", "status": "match", "confidence": 0.92, "createdAt": "2026-09-24T18:02:40.000Z", "utr": "412345678901",
      "imageUrl": "https://…/payment-proofs/…?token=…", "reasons": ["UTR 412345678901 read.", "Amount ₹499.37 matches."] }
  ]
}
```

`source`: `gmail` · `notification` · `screenshot`. `status`: `match` ·
`no_match` · `error`.

---

## Usage

### `GET /api/v1/usage`

```json
{ "tokensToday": 812, "dailyLimit": 20000, "remaining": 19188, "tier": "platform", "resetsAt": "2026-09-25T00:00:00.000Z" }
```

Only verification (Gmail + LLM) and screenshot proofs spend tokens; every
other endpoint is free. `tier` is `own_key` when your own Anthropic key (set
in Dashboard → Settings) pays for calls.

---

## Webhooks

Set an HTTPS URL in [Dashboard → Settings](https://beta-dashboard.upiagent.live/dashboard/settings).
Private and internal addresses are rejected.

```json
{
  "event": "payment.verified",
  "timestamp": "2026-09-24T18:03:12.000Z",
  "deliveryId": "d_4f1c…",
  "data": {
    "paymentId": "8f5b8f0e-…",
    "amount": 499.37,
    "currency": "INR",
    "status": "verified",
    "upiReferenceId": "412345678901",
    "senderName": "R***a",
    "confidence": 0.95,
    "verifiedAt": "2026-09-24T18:03:12.000Z"
  }
}
```

Events: `payment.claimed`, `payment.verified`, `payment.expired`.

**Verify the signature** before trusting a delivery. The header
`X-UpiAgent-Signature` is `sha256=` + the hex HMAC-SHA256 of the **raw request
body**, keyed with your webhook secret (hex):

```ts
import { verifyWebhookSignature } from "upiagent";

export async function POST(req: Request) {
  const raw = await req.text(); // raw body — not re-serialised JSON
  const ok = verifyWebhookSignature(raw, req.headers.get("x-upiagent-signature") ?? "", process.env.UPIAGENT_WEBHOOK_SECRET!);
  if (!ok) return new Response("bad signature", { status: 401 });
  const event = JSON.parse(raw);
  // idempotency: dedupe on event.deliveryId
  return new Response("ok");
}
```

Delivery is retried up to 3 times (after 1 s, 5 s, 25 s). Respond `2xx`
quickly and dedupe on `deliveryId`.

---

## Limits

| What | Limit |
|---|---|
| Create payment | 60 / minute per merchant |
| Payment lifetime | 20 minutes, then `expired` |
| Check now | 10 / minute, 100 / hour per merchant |
| Screenshot proof | 10 / minute, 120 / hour per merchant; 3 MB image |
| LLM tokens | 20,000 / day per merchant by default; resets 00:00 UTC |

---

## Errors

| Status | Meaning |
|---|---|
| 400 | Invalid request — the message names the field, e.g. `amount: amount must be between 1 and 100000` |
| 401 | Missing or invalid API key |
| 404 | Payment not found (or not yours) |
| 409 | Payment is not in a state that allows this (e.g. cancelling a verified payment) |
| 429 | Rate limit or daily token limit reached |
| 500 / 502 / 503 | Server-side problem; safe to retry |

---

## SDK and MCP

- **TypeScript SDK:** `npm i upiagent`, then `import { UpiAgent } from "upiagent/client"` — every endpoint above as a typed method, responses validated. See the package README.
- **AI agents:** the same operations as MCP tools, hosted at `https://beta.upiagent.live/api/mcp` or locally via `npx -y upiagent mcp`. See [mcp.md](./mcp.md).

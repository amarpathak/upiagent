# UPIAgent Integration Guide

Accept UPI payments in your app with one API key. No PG license needed.

**How it works:** You create a payment → we generate a UPI QR code → customer scans and pays → we verify the payment via Gmail bank alerts + AI → you get notified via webhook or polling.

---

## 1. Get Your API Key

1. Sign up at [dashboard.upiagent.dev](https://dashboard.upiagent.dev)
2. Complete onboarding (add your UPI ID, business name)
3. Connect your Gmail (the inbox that receives bank alerts)
4. Go to **API Keys** → Create a new key
5. Copy the key (starts with `upi_ak_...`) — you'll only see it once

---

## 2. Create a Payment

```bash
curl -X POST https://upiagent.dev/api/v1/payments \
  -H "Authorization: Bearer upi_ak_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 499,
    "note": "Order #123",
    "addPaisa": true
  }'
```

**Response (201):**

```json
{
  "id": "a1b2c3d4-...",
  "transactionId": "TXN_m4x7k2_a1b2c3",
  "amount": 499.37,
  "intentUrl": "upi://pay?pa=your@upi&am=499.37&...",
  "qrDataUrl": "data:image/png;base64,...",
  "status": "pending",
  "expiresAt": "2026-04-24T13:35:00Z"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | number | Yes | Amount in INR (1 - 100,000) |
| `note` | string | No | Shows in customer's UPI app |
| `addPaisa` | boolean | No | Adds random paisa (e.g. 499 → 499.37) for unique amount matching |

**`addPaisa` explained:** UPI doesn't return a transaction ID to merchants. We match payments by amount. `addPaisa` makes each payment unique so we can reliably match it. Recommended: always set `true`.

---

## 3. Show QR to Customer

Display the QR code from `qrDataUrl` as an image. On mobile, use `intentUrl` to open the UPI app directly.

```html
<!-- Web -->
<img src="{qrDataUrl}" alt="Scan to pay" />

<!-- Mobile deep link -->
<a href="{intentUrl}">Pay with UPI App</a>
```

---

## 4. Check Payment Status

Poll every 5-10 seconds until `status` changes from `pending`:

```bash
curl https://upiagent.dev/api/v1/payments/{id} \
  -H "Authorization: Bearer upi_ak_YOUR_KEY"
```

**Response:**

```json
{
  "id": "a1b2c3d4-...",
  "transactionId": "TXN_m4x7k2_a1b2c3",
  "amount": 499.37,
  "status": "verified",
  "upiReferenceId": "003538060093",
  "senderName": "JOHN DOE",
  "bankName": "HDFC Bank",
  "confidence": 0.95,
  "verifiedAt": "2026-04-24T13:32:15Z"
}
```

**Status values:** `pending` → `verified` | `expired`

---

## 5. Webhooks (Recommended)

Instead of polling, set a webhook URL in [Dashboard Settings](https://dashboard.upiagent.dev/dashboard/settings). We'll POST to your URL when a payment is verified:

```json
{
  "event": "payment.verified",
  "data": {
    "paymentId": "a1b2c3d4-...",
    "amount": 499.37,
    "upiReferenceId": "003538060093",
    "senderName": "JOHN DOE",
    "bankName": "HDFC Bank",
    "confidence": 0.95
  }
}
```

**Verify the signature** (HMAC-SHA256 with your webhook secret):

```typescript
import crypto from "crypto";

function verifySignature(body: string, sig: string, secret: string) {
  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// sig = request header "X-UpiAgent-Signature"
```

---

## Full Example: Next.js Checkout

**1. Server route — create payment:**

```typescript
// app/api/pay/route.ts
export async function POST(req: Request) {
  const { amount, orderId } = await req.json();

  const res = await fetch("https://upiagent.dev/api/v1/payments", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.UPIAGENT_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount, note: `Order ${orderId}`, addPaisa: true }),
  });

  return Response.json(await res.json());
}
```

**2. Client component — show QR and poll:**

```tsx
"use client";
import { useState, useEffect } from "react";

export function Checkout({ amount }: { amount: number }) {
  const [payment, setPayment] = useState<any>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "verified" | "expired">("idle");

  async function createPayment() {
    const res = await fetch("/api/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, orderId: "ORD_" + Date.now() }),
    });
    const data = await res.json();
    setPayment(data);
    setStatus("pending");
  }

  // Poll for verification
  useEffect(() => {
    if (status !== "pending" || !payment?.id) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/pay/${payment.id}`);
      const data = await res.json();
      if (data.status === "verified") {
        setStatus("verified");
        clearInterval(interval);
      }
      if (data.status === "expired") {
        setStatus("expired");
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [status, payment?.id]);

  if (status === "idle") {
    return <button onClick={createPayment}>Pay Rs.{amount}</button>;
  }
  if (status === "pending") {
    return (
      <div>
        <img src={payment.qrDataUrl} alt="Scan to pay" width={256} height={256} />
        <a href={payment.intentUrl}>Open UPI App</a>
        <p>Waiting for payment...</p>
      </div>
    );
  }
  if (status === "verified") {
    return <p>Payment confirmed!</p>;
  }
  return <p>Payment expired. <button onClick={createPayment}>Try again</button></p>;
}
```

**3. Server route — check status (for polling):**

```typescript
// app/api/pay/[id]/route.ts
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const res = await fetch(`https://upiagent.dev/api/v1/payments/${id}`, {
    headers: { "Authorization": `Bearer ${process.env.UPIAGENT_API_KEY}` },
  });
  return Response.json(await res.json());
}
```

---

## Self-Hosted (npm Package)

Use the open-source package without the SaaS platform:

```bash
npm install upiagent
```

```typescript
import { createPayment, fetchAndVerifyPayment } from "upiagent";

// Create QR
const payment = await createPayment(
  { upiId: "your@upi", name: "My Shop" },
  { amount: 499, addPaisa: true },
);
// Show payment.qrDataUrl to customer

// Verify (after customer pays)
const result = await fetchAndVerifyPayment({
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID!,
    clientSecret: process.env.GMAIL_CLIENT_SECRET!,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN!,
  },
  llm: {
    provider: "gemini",
    model: "gemini-2.0-flash",
    apiKey: process.env.GEMINI_KEY!,
  },
  expected: { amount: payment.amount },
});

console.log(result.verified, result.payment?.upiReferenceId);
```

The self-hosted path requires you to set up Gmail OAuth and an LLM API key yourself. The SaaS platform handles this for you.

---

## API Reference

### Authentication

All requests require `Authorization: Bearer <api_key>` header.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/payments` | Create a payment |
| GET | `/api/v1/payments/:id` | Check payment status |

### Rate Limits

- 30 payment creations per minute per merchant
- Payments expire after 10 minutes

### Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Invalid request (bad amount, missing fields) |
| 401 | Invalid or missing API key |
| 404 | Payment not found |
| 429 | Rate limit exceeded |
| 500 | Server error |

---

## Current Limitations

- ~50 concurrent payments per price point (amount matching)
- Verification takes 10-60 seconds (depends on bank alert email speed)
- Requires Gmail to receive bank alerts
- Best for small-medium transaction volumes

See [limitations-and-roadmap.md](./limitations-and-roadmap.md) for the full roadmap.

---

## Support

- GitHub: [github.com/AmarPathak/upiagent](https://github.com/AmarPathak/upiagent)
- Issues: [github.com/AmarPathak/upiagent/issues](https://github.com/AmarPathak/upiagent/issues)

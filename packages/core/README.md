# @upiagent/core

UPI payment verification without a payment gateway. Generate QR codes, customers pay via any UPI app, verify payments through Gmail bank alerts + AI.

**Zero fees. No merchant onboarding. No Razorpay.**

## Install

```bash
npm install upiagent
```

## Quick start

```typescript
import { createPayment, fetchAndVerifyPayment } from "upiagent";

// 1. Generate a payment QR code
const payment = await createPayment(
  { upiId: "yourshop@ybl", name: "Your Shop" },
  { amount: 499, note: "Order #123" }
);

// payment.qrDataUrl → show this to the customer
// payment.transactionId → save this for verification

// 2. After the customer pays, verify it
const result = await fetchAndVerifyPayment({
  gmail: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
  llm: {
    provider: "gemini",
    model: "gemini-2.0-flash",
    apiKey: process.env.GEMINI_API_KEY,
  },
  expected: { amount: 499 },
});

if (result.verified) {
  // Payment confirmed
  console.log(result.payment); // { amount, senderName, upiReferenceId, ... }
}
```

## How it works

1. You generate a UPI QR code with `createPayment()`
2. Customer scans and pays using any UPI app (GPay, PhonePe, Paytm, etc.)
3. Your bank sends a confirmation email to your Gmail
4. `fetchAndVerifyPayment()` reads that email and verifies the payment through 5 security layers

## Security layers

Every payment goes through a 5-layer validation pipeline:

| Layer | What it checks |
|-------|---------------|
| Email source | Is the email from a known bank? |
| Amount match | Does the amount match exactly? |
| Time window | Was the payment recent (default: 30 min)? |
| LLM confidence | How confident is the AI in its parsing? |
| Deduplication | Has this transaction been verified before? |

## Webhooks

Get notified when payments are verified:

```typescript
import { WebhookSender, verifyWebhookSignature } from "upiagent";

// Send webhooks
const sender = new WebhookSender({
  url: "https://yourapp.com/webhooks/payment",
  secret: "your-webhook-secret",
});

await sender.send({
  event: "payment.verified",
  data: { paymentId: "txn_123", amount: 499, status: "verified" },
});

// Verify incoming webhooks
const isValid = verifyWebhookSignature(requestBody, signature, secret);
```

## Gmail setup

You need a Google Cloud project with Gmail API enabled. Run the setup wizard:

```bash
npx upiagent setup
```

This walks you through OAuth setup and gives you the refresh token.

## LLM providers

Works with any of these (Gemini is free):

| Provider | Model | Cost |
|----------|-------|------|
| Google Gemini | gemini-2.0-flash | Free |
| OpenAI | gpt-4o-mini | Paid |
| Anthropic | claude-3-haiku | Paid |

## Docs

Full documentation: [upiagent.dev/docs](https://upiagent.dev/docs)

## License

MIT

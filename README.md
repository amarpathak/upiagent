<div align="center">
  <img src="logo.png" alt="upiagent" width="120" />
  <h1>upiagent</h1>
  <p>UPI payment verification via Gmail bank alerts and LLM parsing.<br/>Zero fees. No merchant onboarding. No Razorpay.</p>

  [![npm version](https://img.shields.io/npm/v/upiagent.svg)](https://www.npmjs.com/package/upiagent)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![CI](https://github.com/amarpathak/upiagent/actions/workflows/ci.yml/badge.svg)](https://github.com/amarpathak/upiagent/actions/workflows/ci.yml)
</div>

---

## How it works

1. **Generate a QR code** — embed your UPI ID and amount into a scannable QR.
2. **Customer pays** — they scan with any UPI app (PhonePe, GPay, Paytm, etc.).
3. **Verify via Gmail** — poll the merchant's inbox for bank credit alert emails.
4. **LLM parses the alert** — extract amount, UTR, sender, and timestamp from the raw email.
5. **5-layer security pipeline** — format check → bank source → amount → time window → dedup.

No payment gateway SDK. No webhooks from a third party. No merchant onboarding. Just your UPI ID and a Gmail inbox.

---

## Table of Contents

- [Install](#install)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Quick Start](#quick-start)
- [LLM Providers](#llm-providers)
- [Gmail Setup](#gmail-setup)
- [API Reference](#api-reference)
  - [createPayment / createPaymentSvg](#createpayment--createpaymentsvg)
  - [fetchAndVerifyPayment](#fetchandverifypayment)
  - [verifyPayment](#verifypayment)
  - [VerificationResult](#verificationresult)
  - [ParsedPayment](#parsedpayment)
- [Security Layers](#security-layers)
- [Duplicate Detection](#duplicate-detection)
- [Verification Sessions](#verification-sessions)
- [Webhooks](#webhooks)
- [Observability](#observability)
- [Bank Registry](#bank-registry)
- [Crypto Utilities](#crypto-utilities)
- [Error Handling](#error-handling)
- [Contributing](#contributing)

---

## Install

```bash
npm install upiagent
```

---

## Prerequisites

- **Node.js >= 18** — the package uses ESM and native `fetch`.
- **Gmail OAuth credentials** — a Google Cloud project with the Gmail API enabled, plus a refresh token for the merchant's inbox. See [Gmail Setup](#gmail-setup).
- **At least one LLM API key** — OpenAI, Anthropic, Google Gemini, or OpenRouter. See [LLM Providers](#llm-providers).

---

## Environment Setup

Copy `.env.example` to `.env` and fill in your credentials:

```bash
# Gmail OAuth
GMAIL_CLIENT_ID=your_client_id_here
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_REFRESH_TOKEN=your_refresh_token_here

# LLM — set ONE of the following
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
OPENROUTER_API_KEY=sk-or-...
```

Use the built-in validators to get clear errors at startup instead of cryptic runtime failures:

```ts
import { validateGmailEnv, validateLlmEnv } from "upiagent";

// Throws ConfigError with actionable message if any var is missing
const gmail = validateGmailEnv();
const llm = validateLlmEnv(); // auto-detects provider from whichever key is set
```

`validateLlmEnv` checks keys in order: `OPENAI_API_KEY` → `ANTHROPIC_API_KEY` → `GOOGLE_GENERATIVE_AI_API_KEY` → `OPENROUTER_API_KEY`. It picks the first one found and sets a sensible default model.

---

## Quick Start

```ts
import { createPayment, fetchAndVerifyPayment } from "upiagent";

// Step 1: Generate a payment QR code
const payment = await createPayment(
  { upiId: "shop@ybl", name: "My Shop" },
  { amount: 499, note: "Order #123" },
);

// Show payment.qrDataUrl in an <img> tag — customer scans and pays

// Step 2: After the customer pays, verify via Gmail
const result = await fetchAndVerifyPayment({
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID!,
    clientSecret: process.env.GMAIL_CLIENT_SECRET!,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN!,
  },
  llm: {
    provider: "gemini",
    model: "gemini-2.0-flash",
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
  },
  expected: { amount: 499 },
});

if (result.verified) {
  console.log("Payment confirmed!", result.payment?.upiReferenceId);
} else {
  console.log("Not verified:", result.failureReason);
}
```

Using environment validation (recommended for production):

```ts
import { createPayment, fetchAndVerifyPayment, validateGmailEnv, validateLlmEnv } from "upiagent";

const gmail = validateGmailEnv();
const llm = validateLlmEnv();

const payment = await createPayment(
  { upiId: "shop@ybl", name: "My Shop" },
  { amount: 499, addPaisa: true }, // addPaisa makes the amount unique for exact matching
);

const result = await fetchAndVerifyPayment({
  gmail,
  llm,
  expected: { amount: payment.amount }, // use payment.amount to get the paisa-adjusted value
  lookbackMinutes: 30,
});
```

---

## LLM Providers

| Provider | `provider` value | Key env var | Example model |
|---|---|---|---|
| OpenAI | `"openai"` | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Anthropic | `"anthropic"` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-5-20250514` |
| Google Gemini | `"gemini"` | `GOOGLE_GENERATIVE_AI_API_KEY` | `gemini-2.0-flash` |
| OpenRouter | `"openrouter"` | `OPENROUTER_API_KEY` | `openai/gpt-4o-mini` |
| OpenAI-compatible | `"openai-compatible"` | any | any |

For self-hosted or custom endpoints (vLLM, Ollama, TGI):

```ts
const llm = {
  provider: "openai-compatible" as const,
  apiKey: "local",
  model: "mistral-7b-instruct",
  baseUrl: "http://localhost:8000/v1",
};
```

The model field is always required — there are no silent defaults. This keeps cost, capability, and version stability under your control.

---

## Gmail Setup

Run `npx upiagent setup` for an interactive OAuth setup guide, or see [Gmail OAuth Setup Guide](https://github.com/amarpathak/upiagent/wiki/Gmail-Setup) for manual instructions.

The setup flow uses `setupGmailAuth` internally:

```ts
import { setupGmailAuth } from "upiagent";

const result = await setupGmailAuth({
  clientId: "...",
  clientSecret: "...",
  // Launches a local server to capture the OAuth redirect
});

console.log(result.refreshToken); // save this to GMAIL_REFRESH_TOKEN
```

---

## API Reference

### `createPayment` / `createPaymentSvg`

Generate a UPI payment QR code.

```ts
import { createPayment, createPaymentSvg } from "upiagent";
import type { MerchantConfig, CreatePaymentOptions, PaymentRequest } from "upiagent";

const merchant: MerchantConfig = {
  upiId: "shop@ybl",   // your UPI ID
  name: "My Shop",     // shown in the customer's UPI app
};

const options: CreatePaymentOptions = {
  amount: 499,          // INR
  addPaisa: true,       // add random 0.01–0.99 for unique amount fingerprinting
  transactionId: "ord_123", // your internal reference (generated if omitted)
  note: "Order #123",
};

const payment: PaymentRequest = await createPayment(merchant, options);
// payment.qrDataUrl  — base64 PNG, use in <img src={payment.qrDataUrl} />
// payment.intentUrl  — the raw UPI intent URL the QR encodes
// payment.amount     — actual amount (may differ from options.amount when addPaisa: true)
// payment.transactionId — your reference ID

// SVG variant (scalable, no canvas dependency)
const svgString: string = await createPaymentSvg(merchant, options);
```

**`PaymentRequest` type:**

| Field | Type | Description |
|---|---|---|
| `transactionId` | `string` | Your internal reference ID |
| `intentUrl` | `string` | The UPI intent URL encoded in the QR |
| `qrDataUrl` | `string` | Base64 PNG data URL, use in `<img>` |
| `amount` | `number` | Amount in INR (includes paisa if `addPaisa: true`) |
| `createdAt` | `Date` | When this payment request was created |
| `merchantUpiId` | `string` | The UPI ID receiving the payment |

**Why `addPaisa`?** A ₹499 payment becomes ₹499.37 (random). Each QR is unique by amount, so verification can match exactly even when multiple customers pay similar amounts simultaneously. Store `payment.amount` and pass it to `expected.amount` when verifying.

### `buildUpiIntentUrl` / `generateTransactionId`

Low-level utilities if you want to build intent URLs yourself:

```ts
import { buildUpiIntentUrl, generateTransactionId } from "upiagent";

const url = buildUpiIntentUrl({
  upiId: "shop@ybl",
  name: "My Shop",
  amount: 499,
  transactionId: "ord_123",
  note: "Order #123",
});
// → "upi://pay?pa=shop@ybl&pn=My+Shop&am=499&tr=ord_123&tn=Order+%23123&cu=INR"

const txnId = generateTransactionId();
// → "TXN_1720000000000_a1b2c3"
```

---

### `fetchAndVerifyPayment`

Fetch bank alert emails from Gmail and verify each one until a match is found.

```ts
import { fetchAndVerifyPayment } from "upiagent";
import type { FetchAndVerifyOptions, VerificationResult } from "upiagent";

const result: VerificationResult = await fetchAndVerifyPayment({
  // Gmail credentials
  gmail: { clientId, clientSecret, refreshToken },

  // LLM configuration
  llm: { provider: "gemini", model: "gemini-2.0-flash", apiKey },

  // What to verify against
  expected: {
    amount: 499,
    timeWindowMinutes: 30,        // default: 30
    amountTolerancePercent: 0,    // default: 0 (exact match)
  },

  // Gmail fetch options
  lookbackMinutes: 30,            // how far back to search (default: 30)
  maxEmails: 10,                  // max emails to fetch per call (default: 10)

  // Polling optimization — skip already-seen message IDs
  skipMessageIds: seenIds,        // Set<string> from previous result.processedMessageIds

  // UTR hints from customer (see Verification Sessions)
  expectedUtrs: ["412345678901"],

  // Optional utilities
  dedup: myDedupStore,
  rateLimiter: myRateLimiter,
  costTracker: myCostTracker,
  stepLogger: myStepLogger,
  preset: "demo",                 // redact PII in result
});
```

**Polling pattern:**

```ts
let seenIds = new Set<string>();

const poll = setInterval(async () => {
  const result = await fetchAndVerifyPayment({
    ...baseOptions,
    skipMessageIds: seenIds,
  });

  // Accumulate seen IDs to avoid re-parsing on next poll
  for (const id of result.processedMessageIds ?? []) {
    seenIds.add(id);
  }

  if (result.verified) {
    clearInterval(poll);
    handleVerified(result);
  }
}, 5_000);
```

---

### `verifyPayment`

Verify a single `EmailMessage` you have already fetched.

```ts
import { verifyPayment } from "upiagent";
import type { VerifyPaymentOptions } from "upiagent";

const result = await verifyPayment(email, {
  llm: { provider: "openai", model: "gpt-4o-mini", apiKey },
  expected: { amount: 499 },
  expectedUtrs: ["412345678901"],
  dedup: myDedupStore,
});
```

**Pipeline steps:**
1. Pre-LLM gate — skip emails that are clearly not payment notifications (saves tokens)
2. Rate limiter check (if provided)
3. LLM parsing via `parsePaymentEmail`
4. UTR hint matching — if a UTR matches, the amount layer is skipped
5. Security validation — format → bank source → amount → time window → dedup

---

### `VerificationResult`

Returned by both `verifyPayment` and `fetchAndVerifyPayment`.

```ts
interface VerificationResult {
  verified: boolean;               // true if all layers passed
  payment: ParsedPayment | null;   // LLM-extracted data (present even on failure)
  confidence: number;              // LLM confidence 0–1
  failureReason?: ValidationFailureReason;
  failureDetails?: string;         // human-readable explanation
  matchedVia?: "utr_hint" | "amount";
  layerResults: {
    layer: string;
    passed: boolean;
    details?: string;
  }[];
  processedMessageIds?: string[];  // Gmail IDs seen — pass as skipMessageIds on next poll
  steps?: { step: string; ts: string; [key: string]: unknown }[]; // pipeline trace
}
```

**`ValidationFailureReason` codes:**

| Code | Meaning |
|---|---|
| `NOT_PAYMENT_EMAIL` | Email is not a UPI credit notification |
| `LOW_CONFIDENCE` | LLM confidence below threshold |
| `AMOUNT_MISMATCH` | Extracted amount does not match expected |
| `OUTSIDE_TIME_WINDOW` | Payment is older than `timeWindowMinutes` |
| `DUPLICATE_TRANSACTION` | UTR already processed (dedup) |
| `FORMAT_INVALID` | LLM output failed schema validation |

---

### `ParsedPayment`

The structured data the LLM extracts from a bank alert email.

```ts
interface ParsedPayment {
  amount: number;          // transaction amount in INR
  upiReferenceId: string;  // 12-digit UTR / UPI reference number
  senderName: string;      // payer's name
  senderUpiId: string;     // payer's UPI ID (e.g., "john@ybl")
  bankName: string;        // bank that sent the alert
  timestamp: string;       // ISO 8601 transaction time
  status: "success" | "failed" | "pending";
  rawSubject: string;      // original email subject
  confidence: number;      // 0–1 extraction confidence
  isPaymentEmail: boolean; // LLM's own assessment
}
```

You can also call `parsePaymentEmail` and `createPaymentExtractionChain` directly if you want to use the LLM parsing layer independently:

```ts
import { parsePaymentEmail, createPaymentExtractionChain, sanitizeEmailForLlm } from "upiagent";

const chain = createPaymentExtractionChain(llmConfig);
const parsed = await parsePaymentEmail(email, llmConfig);
```

---

## Security Layers

`SecurityValidator` runs a 5-layer fail-fast pipeline. You can instantiate it directly for custom verification flows:

```ts
import { SecurityValidator, InMemoryDedupStore } from "upiagent";
import type { SecurityConfig } from "upiagent";

const config: SecurityConfig = {
  timeWindowMinutes: 30,       // default: 30
  amountTolerancePercent: 0,   // default: 0 — exact match
};

const dedup = new InMemoryDedupStore(60); // TTL: 60 minutes
const validator = new SecurityValidator(config, dedup);

const result = await validator.validate(
  parsedPayment,
  { expectedAmount: 499 },
  emailReceivedAt, // Date — Gmail's server-side timestamp
  { from: "alerts@hdfcbank.net" },
  { skipAmountLayer: false },
);
```

**Layer breakdown:**

| Layer | What it checks | Failure reason |
|---|---|---|
| **1. Format** | `isPaymentEmail === true`, confidence >= 0.5 | `NOT_PAYMENT_EMAIL`, `LOW_CONFIDENCE` |
| **1.5. Bank Source** | Sender is a known bank; unknown senders need confidence >= 0.8 | `LOW_CONFIDENCE` |
| **2. Amount** | Extracted amount matches expected (within tolerance) | `AMOUNT_MISMATCH` |
| **3. Time Window** | Payment timestamp within `timeWindowMinutes` of now | `OUTSIDE_TIME_WINDOW` |
| **4. Duplicate** | UTR not previously seen in dedup store | `DUPLICATE_TRANSACTION` |

---

## Duplicate Detection

Two `DedupStore` implementations are provided. Pass either to `SecurityValidator`, `verifyPayment`, or `fetchAndVerifyPayment` via the `dedup` option.

**In-memory (default):**

```ts
import { InMemoryDedupStore } from "upiagent";

// TTL: 60 minutes — entries expire after 60 min
const dedup = new InMemoryDedupStore(60);
```

**PostgreSQL (persistent — survives restarts, works across multiple instances):**

```ts
import { PostgresDedupStore } from "upiagent";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const dedup = new PostgresDedupStore(pool);

// Run once to create the table
await dedup.migrate();

// Use with verifyPayment
const result = await fetchAndVerifyPayment({ ..., dedup });
```

The `pg` package is a peer dependency and must be installed separately when using `PostgresDedupStore`:

```bash
npm install pg
```

**Custom store** — implement the `DedupStore` interface:

```ts
import type { DedupStore } from "upiagent";

class RedisDedupStore implements DedupStore {
  async has(utrId: string): Promise<boolean> { /* ... */ }
  async add(utrId: string): Promise<void> { /* ... */ }
}
```

---

## Verification Sessions

`createVerificationSession` manages the full lifecycle of a payment verification — polling, UTR escalation, timeout, and cancellation — behind a simple interface.

```ts
import { createVerificationSession } from "upiagent";

const session = await createVerificationSession({
  amount: 499,
  orderId: "ord_123",

  gmail: { clientId, clientSecret, refreshToken },
  llm: { provider: "gemini", model: "gemini-2.0-flash", apiKey },

  timeoutMs: 600_000,       // 10 minutes (default)
  pollIntervalMs: 5_000,    // 5 seconds between polls (default)
  utrDelayMs: 20_000,       // escalate to UTR after 20s of no match (default)

  onVerified: (result) => {
    console.log("Verified!", result.payment?.upiReferenceId);
  },
  onAwaitingUtr: () => {
    // Show "Please share your payment UTR" UI to customer
    showUtrInputModal();
  },
  onTimeout: () => {
    console.log("Session timed out");
  },
});

// When customer shares their UTR (from screenshot or manual input)
session.registerUTR("412345678901");

// Or extract UTR from a screenshot/text blob
import { extractUtrFromText, extractUtrFromImage } from "upiagent";
const candidates = extractUtrFromText("Your UPI ref is 412345678901");
session.registerUTR(candidates[0].utr);

// Wait for resolution
const result = await session.promise;

// Cancel if needed
session.cancel();
```

**Session status values:**

| Status | Meaning |
|---|---|
| `pending` | Polling with amount matching |
| `awaiting_utr` | Escalated — waiting for customer UTR input |
| `verified` | Payment confirmed |
| `timeout` | Timed out without finding a match |
| `cancelled` | Manually cancelled |

**UTR store** — share a single store across sessions to prevent double-crediting:

```ts
import { InMemoryUtrStore } from "upiagent";
import type { UtrStore } from "upiagent";

const utrStore = new InMemoryUtrStore();
```

---

## Webhooks

Deliver HMAC-signed payment events to your backend or a third party.

```ts
import { WebhookSender, signWebhookPayload, verifyWebhookSignature } from "upiagent";
import type { WebhookConfig, WebhookPayload } from "upiagent";

const config: WebhookConfig = {
  url: "https://your-server.com/webhooks/payment",
  secret: process.env.WEBHOOK_SECRET!,
};

const sender = new WebhookSender(config);

const payload: WebhookPayload = {
  event: "payment.verified",
  timestamp: new Date().toISOString(),
  deliveryId: crypto.randomUUID(),
  data: {
    paymentId: "ord_123",
    amount: 499,
    currency: "INR",
    status: "verified",
    upiReferenceId: "412345678901",
    senderName: "John Doe",
    confidence: 0.97,
    verifiedAt: new Date().toISOString(),
  },
};

const delivery = await sender.send(payload);
// delivery.delivered  — true/false
// delivery.attempts   — number of attempts made
// delivery.responseStatus — HTTP status from your server
```

**Webhook events:**

| Event | When |
|---|---|
| `payment.verified` | Payment passed all security layers |
| `payment.expired` | Session timed out without verification |

**Verify signatures on your server:**

```ts
import { verifyWebhookSignature } from "upiagent";

// In your webhook handler:
const isValid = verifyWebhookSignature(
  rawBodyString,
  request.headers["x-upiagent-signature"],
  process.env.WEBHOOK_SECRET!,
);

if (!isValid) {
  return response.status(401).send("Invalid signature");
}
```

**Sign manually:**

```ts
import { signWebhookPayload } from "upiagent";

const signature = signWebhookPayload(JSON.stringify(payload), secret);
```

---

## Observability

### StepLogger

Records a step-by-step trace of the verification pipeline. Useful for debugging, support tickets, and building training data.

```ts
import { StepLogger, fetchAndVerifyPayment } from "upiagent";

const logger = new StepLogger();

const result = await fetchAndVerifyPayment({
  ...options,
  stepLogger: logger,
});

// Steps are also attached to result.steps
console.log(result.steps);
// [
//   { step: "gmail_fetch", ts: "...", emails_found: 3, ... },
//   { step: "pre_llm_gate", ts: "...", skipped: false, ... },
//   { step: "llm_call", ts: "...", provider: "gemini", ... },
//   { step: "llm_response", ts: "...", is_payment_email: true, confidence: 0.97, ... },
//   { step: "security_validation", ts: "...", verified: true, layers: [...], ... },
// ]
```

### Logger

Structured logger with pluggable handlers. Defaults to console output.

```ts
import { Logger } from "upiagent";
import type { LogLevel, LogHandler } from "upiagent";

const logger = new Logger("info");

// Custom handler — send to your logging service
const handler: LogHandler = (level, message, meta) => {
  myLoggingService.log({ level, message, ...meta });
};
logger.addHandler(handler);

logger.info("Payment verified", { utr: "412345678901", amount: 499 });
logger.error("LLM call failed", { error: err.message });
```

### CostTracker

Track LLM token usage and enforce a budget ceiling.

```ts
import { CostTracker, fetchAndVerifyPayment } from "upiagent";

const tracker = new CostTracker({ budgetTokens: 50_000 });

const result = await fetchAndVerifyPayment({
  ...options,
  costTracker: tracker,
});

const usage = tracker.getUsage();
console.log(usage.totalTokens, usage.promptTokens, usage.completionTokens);
```

When `budgetTokens` is exceeded, `LlmBudgetExceededError` is thrown.

### LlmRateLimiter

Throttle LLM calls to stay within provider rate limits.

```ts
import { LlmRateLimiter, fetchAndVerifyPayment } from "upiagent";

// Max 10 requests per minute
const limiter = new LlmRateLimiter({ requestsPerMinute: 10 });

const result = await fetchAndVerifyPayment({
  ...options,
  rateLimiter: limiter,
});
```

### withRetry

Retry any async operation with exponential backoff.

```ts
import { withRetry } from "upiagent";

const result = await withRetry(
  () => fetchAndVerifyPayment(options),
  { maxAttempts: 3, initialDelayMs: 1000 },
);
```

---

## Bank Registry

Built-in patterns for 14 banks and UPI apps: HDFC, SBI, ICICI, Kotak, Axis, Bank of Baroda, PNB, Yes Bank, IDBI, Union Bank, Canara, Indian Bank, PhonePe, Google Pay, Paytm.

Register additional banks or corporate sender addresses:

```ts
import { registerBankPattern, isKnownBankEmail } from "upiagent";
import type { BankPattern } from "upiagent";

registerBankPattern({
  name: "my-corporate-bank",
  senderPatterns: ["alerts@mycorporatebank.com"],
  bodyPatterns: [/credited Rs\.[\d,]+/i],
});

const result = isKnownBankEmail("alerts@mycorporatebank.com");
// → { known: true, bankName: "my-corporate-bank" }
```

Unknown senders are not blocked — they require LLM confidence >= 0.8 to pass the bank source security layer instead of the normal 0.5 threshold.

---

## Crypto Utilities

Encrypt and decrypt sensitive credentials (e.g., before storing refresh tokens in a database).

```ts
import { encrypt, decrypt, isEncrypted, generateKey } from "upiagent";

const key = generateKey(); // generate a random 32-byte hex key

const encrypted = encrypt(refreshToken, key);
// → "enc:iv:ciphertext" — safe to store

const decrypted = decrypt(encrypted, key);
// → original refresh token

if (isEncrypted(value)) {
  const plain = decrypt(value, key);
}
```

Store the key in an environment variable (e.g., `ENCRYPTION_KEY`), never alongside the encrypted data.

---

## Error Handling

All errors extend `UpiAgentError`. Catch the base class to handle any library error, or catch specific subclasses for granular control.

```ts
import {
  UpiAgentError,
  GmailAuthError,
  GmailRateLimitError,
  LlmError,
  LlmRateLimitError,
  LlmBudgetExceededError,
  ConfigError,
} from "upiagent";

try {
  const result = await fetchAndVerifyPayment(options);
} catch (err) {
  if (err instanceof GmailAuthError) {
    // Credentials expired — re-run OAuth flow
    await refreshGmailAuth();
  } else if (err instanceof GmailRateLimitError) {
    // Back off and retry
    await sleep(60_000);
  } else if (err instanceof LlmRateLimitError) {
    // err.retryAfterMs is set when the provider includes Retry-After
    await sleep(err.retryAfterMs ?? 5_000);
  } else if (err instanceof LlmBudgetExceededError) {
    console.error(`Budget exceeded: ${err.totalTokensUsed} / ${err.budgetTokens} tokens`);
  } else if (err instanceof ConfigError) {
    // Missing env vars or invalid config — fix before retrying
    console.error(err.message);
    process.exit(1);
  } else if (err instanceof UpiAgentError) {
    // Any other library error
    console.error(err.code, err.message);
  } else {
    throw err; // re-throw unknown errors
  }
}
```

**Error classes:**

| Class | `code` | When thrown |
|---|---|---|
| `UpiAgentError` | (base) | Base class for all library errors |
| `GmailAuthError` | `GMAIL_AUTH_ERROR` | OAuth credentials invalid or expired |
| `GmailRateLimitError` | `GMAIL_RATE_LIMIT` | Gmail API rate limit hit |
| `LlmError` | `LLM_ERROR` | LLM API call failed |
| `LlmRateLimitError` | `LLM_RATE_LIMIT` | LLM provider rate limit; has `.retryAfterMs` |
| `LlmBudgetExceededError` | `LLM_BUDGET_EXCEEDED` | Token budget exceeded; has `.totalTokensUsed`, `.budgetTokens` |
| `ConfigError` | `CONFIG_ERROR` | Missing env vars or invalid configuration |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

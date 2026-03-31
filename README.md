# upiagent

**UPI payment gateway — no Razorpay, no PayU, just UPI.**

Generate payment QR codes, let customers pay via any UPI app, and verify payments automatically through Gmail bank alerts + LLM parsing.

```
  Your App          Customer            Bank
     │                  │                 │
     │  1. QR code      │                 │
     │ ───────────────► │                 │
     │                  │  2. Scans & pays│
     │                  │ ──────────────► │
     │                  │                 │
     │  3. Verify via Gmail + LLM        │
     │ ◄──────────────────────────────── │
     │  ✅ Payment confirmed             │
```

## Why?

Traditional payment gateways charge 2-3% per transaction and require merchant onboarding. UPI is free for peer-to-peer payments, but there's no API to check if someone actually paid.

**upiagent solves this**: it reads your bank's email alerts via Gmail API and uses an LLM to extract payment details — amount, UPI reference, sender, timestamp — then validates it against what you expected.

## Quick Start

```bash
npm install upiagent
# or
pnpm add upiagent
```

```typescript
import { UpiAgent } from "upiagent";

const agent = new UpiAgent({
  merchant: {
    upiId: "yourshop@ybl",
    name: "Your Shop",
  },
  gmail: {
    clientId: "your-google-client-id",
    clientSecret: "your-google-client-secret",
    refreshToken: "your-refresh-token",
  },
  llm: {
    provider: "openai", // or "anthropic"
    apiKey: "sk-...",
  },
});

// Step 1: Generate payment QR
const payment = await agent.createPayment({
  amount: 499,
  note: "Order #123",
});

// payment.qrDataUrl → base64 PNG, use in <img src={payment.qrDataUrl} />
// payment.intentUrl → upi://pay?... for mobile deep links
// payment.transactionId → your reference ID

// Step 2: After customer pays, verify
const result = await agent.verifyPayment({
  expectedAmount: 499,
  lookbackMinutes: 30,
});

if (result.verified) {
  console.log("Payment confirmed!", result.payment);
  console.log("UPI Ref:", result.payment.upiReferenceId);
  console.log("Confidence:", result.confidence);
} else {
  console.log("Not verified:", result.failureReason);
  // "AMOUNT_MISMATCH" | "OUTSIDE_TIME_WINDOW" | "DUPLICATE_TRANSACTION" | ...
}
```

## How It Works

### 1. QR Generation

upiagent generates standard UPI intent URLs (`upi://pay?...`) and renders them as QR codes. Any UPI app (GPay, PhonePe, Paytm, CRED) can scan and pay. No merchant registration needed — just your UPI ID.

### 2. LLM-Powered Verification

Instead of regex (which breaks when banks change email formats), upiagent uses an LLM to intelligently parse bank alert emails:

- Works across all Indian banks (HDFC, SBI, ICICI, Axis, Kotak, etc.)
- Handles format variations, Hindi/English, different templates
- Extracts: amount, UPI reference ID, sender, timestamp, status
- Returns a confidence score for each extraction

### 3. 4-Layer Security

Every parsed payment goes through a security pipeline:

| Layer | Protects Against |
|-------|-----------------|
| **Format Validation** | LLM hallucinations, non-payment emails |
| **Amount Matching** | Wrong payment amount, underpayment |
| **Time Window** | Replay attacks, stale payment emails |
| **Duplicate Detection** | Double-spend, duplicate processing |

## Prerequisites

### Gmail API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable Gmail API
3. Create OAuth 2.0 credentials (Desktop app type)
4. Generate a refresh token using the OAuth playground or the setup script

See [Gmail Setup Guide](docs/gmail-setup.md) for detailed steps.

### LLM Provider

You need an API key from one of:
- **OpenAI** — [platform.openai.com](https://platform.openai.com/)
- **Anthropic** — [console.anthropic.com](https://console.anthropic.com/)

Recommended models:
- `gpt-4o-mini` — cheapest, great for extraction (~$0.0001/verification)
- `claude-sonnet-4-5-20250514` — best instruction following

## API Reference

### `new UpiAgent(config)`

```typescript
const agent = new UpiAgent({
  merchant: {
    upiId: string;      // Your UPI ID (e.g., "shop@ybl")
    name: string;        // Display name in UPI apps
  },
  gmail: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  },
  llm: {
    provider: "openai" | "anthropic";
    apiKey: string;
    model?: string;       // Override default model
    temperature?: number; // 0 = deterministic (default)
  },
  security?: {
    timeWindowMinutes?: number;      // Default: 30
    amountTolerancePercent?: number;  // Default: 0 (exact match)
  },
  logging?: {
    level?: "debug" | "info" | "warn" | "error";
    handler?: (entry: LogEntry) => void;  // Custom log handler
  },
  costControl?: {
    budgetTokens?: number;  // Max tokens, 0 = unlimited
    maxRetries?: number;    // Default: 3
  },
});
```

### `agent.createPayment(options)`

Generate a UPI payment QR code.

```typescript
const payment = await agent.createPayment({
  amount: 499,               // Amount in INR
  note: "Order #123",        // Optional: shown in UPI app
  transactionId: "MY_REF",   // Optional: your reference ID
});

// Returns:
{
  transactionId: string;     // Reference ID
  intentUrl: string;         // upi://pay?...
  qrDataUrl: string;         // data:image/png;base64,...
  amount: number;
  createdAt: Date;
  merchantUpiId: string;
}
```

### `agent.verifyPayment(request, gmailOptions?)`

Verify a payment was received via Gmail bank alerts.

```typescript
const result = await agent.verifyPayment({
  expectedAmount: 499,
  expectedFrom: "customer@upi",  // Optional
  lookbackMinutes: 30,           // Optional
});

// Returns:
{
  verified: boolean;
  payment: ParsedPayment | null;
  confidence: number;               // 0.0 - 1.0
  failureReason?: string;           // Machine-readable code
  failureDetails?: string;          // Human-readable explanation
  layerResults: Array<{             // Per-layer security results
    layer: string;
    passed: boolean;
    details?: string;
  }>;
}
```

### Standalone Functions

You can also use individual modules without the agent:

```typescript
import {
  buildUpiIntentUrl,    // Generate UPI intent URLs
  createPayment,        // Generate QR codes
  GmailClient,          // Fetch emails directly
  parsePaymentEmail,    // Parse a single email with LLM
  SecurityValidator,    // Run security checks
} from "upiagent";
```

## Next.js Integration

```typescript
// app/api/payment/create/route.ts
import { UpiAgent } from "upiagent";

const agent = new UpiAgent({ /* config */ });

export async function POST(req: Request) {
  const { amount, orderId } = await req.json();

  const payment = await agent.createPayment({
    amount,
    note: `Order ${orderId}`,
    transactionId: orderId,
  });

  return Response.json({
    qrDataUrl: payment.qrDataUrl,
    transactionId: payment.transactionId,
  });
}
```

```typescript
// app/api/payment/verify/route.ts
export async function POST(req: Request) {
  const { amount } = await req.json();

  const result = await agent.verifyPayment({ expectedAmount: amount });

  return Response.json(result);
}
```

## Cost Estimation

| Model | Cost per verification | 1000 verifications |
|-------|----------------------|-------------------|
| gpt-4o-mini | ~$0.0001 | ~$0.10 |
| gpt-4o | ~$0.005 | ~$5.00 |
| claude-sonnet | ~$0.007 | ~$7.00 |

Each verification ≈ 500-800 tokens (system prompt + email + structured output).

## Security

- **No payment credentials flow through your server** — customers pay directly via UPI
- **Gmail OAuth uses refresh tokens** — no stored passwords
- **LLM output is validated by Zod schemas** — hallucinations are caught
- **4-layer security pipeline** — defense-in-depth
- **Duplicate detection** — prevents double-crediting
- **Time window enforcement** — blocks replay attacks

## Development

```bash
pnpm install
pnpm build         # Build the package
pnpm test          # Run tests
pnpm dev           # Watch mode
pnpm lint          # ESLint + type check
pnpm publish:dry   # Test npm publish
```

## License

MIT

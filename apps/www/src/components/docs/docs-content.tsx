"use client";

import { CodeBlock } from "@/components/code-block";

function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="font-serif text-[28px] font-normal tracking-tight scroll-mt-24 mb-4"
    >
      {children}
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-sans text-[16px] font-semibold tracking-tight mt-8 mb-3">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] text-foreground/70 leading-7 mb-4">{children}</p>;
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded-md bg-surface-raised border border-border font-mono text-[13px]">
      {children}
    </code>
  );
}

function Callout({
  children,
  type = "info",
}: {
  children: React.ReactNode;
  type?: "info" | "warning";
}) {
  const colors =
    type === "warning"
      ? "border-strike-red/20 bg-strike-red/[0.03]"
      : "border-accent-green/20 bg-accent-green/[0.03]";
  return (
    <div className={`rounded-xl border ${colors} px-5 py-4 mb-6`}>
      <div className="text-[13px] text-foreground/70 leading-7">{children}</div>
    </div>
  );
}

export function DocsContent() {
  return (
    <article className="min-w-0 flex-1 max-w-2xl">
      {/* Header */}
      <div className="mb-12">
        <p className="text-[11px] text-muted-light tracking-[2px] uppercase mb-3">
          Documentation
        </p>
        <h1 className="font-serif text-[42px] font-normal tracking-tight mb-4">
          Get started with{" "}
          <span className="bg-gradient-to-r from-accent-green to-accent-blue bg-clip-text text-transparent">
            upiagent
          </span>
        </h1>
        <P>
          Accept UPI payments directly into your bank account. No payment gateway,
          no fees, no merchant onboarding. Just install the package and go.
        </P>
      </div>

      {/* Install */}
      <section className="mb-16">
        <SectionHeading id="install">Install</SectionHeading>
        <CodeBlock
          code="npm install upiagent"
          lang="bash"
          filename="terminal"
        />
        <P>
          That&apos;s it. The package has zero native dependencies and works in
          Node.js 18+.
        </P>
      </section>

      {/* Quick start */}
      <section className="mb-16">
        <SectionHeading id="quick-start">Quick start</SectionHeading>
        <P>
          The full flow in 20 lines. Generate a QR, customer pays, you verify.
        </P>
        <CodeBlock
          code={`import { createPayment, fetchAndVerifyPayment } from "upiagent";

// Step 1 — Generate a payment QR code
const payment = await createPayment(
  { upiId: "yourshop@ybl", name: "Your Shop" },
  { amount: 499, note: "Order #123" }
);

// Show payment.qrDataUrl to the customer (it's a base64 PNG)
// Save payment.transactionId to your database

// Step 2 — After the customer pays, verify it
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
  console.log("Payment confirmed!", result.payment);
}`}
          lang="typescript"
          filename="checkout.ts"
        />
      </section>

      {/* Generate QR */}
      <section className="mb-16">
        <SectionHeading id="generate-qr">Generate QR</SectionHeading>
        <P>
          <InlineCode>createPayment()</InlineCode> generates a UPI intent URL
          and encodes it as a QR code. Customers scan this with any UPI
          app — GPay, PhonePe, Paytm, CRED, etc.
        </P>
        <CodeBlock
          code={`import { createPayment } from "upiagent";

const payment = await createPayment(
  { upiId: "shop@ybl", name: "My Shop" },
  {
    amount: 299,
    note: "Order #456",
    addPaisa: true,  // adds random paisa for unique amount matching
  }
);

// payment.qrDataUrl      → base64 PNG, use in <img src={...} />
// payment.intentUrl      → upi://pay?pa=shop@ybl&am=299.42&...
// payment.transactionId  → "txn_a1b2c3d4"
// payment.amount         → 299.42 (with random paisa added)`}
          lang="typescript"
          filename="create-payment.ts"
        />

        <SubHeading>Why addPaisa?</SubHeading>
        <P>
          When <InlineCode>addPaisa: true</InlineCode>, a random amount between
          0.01 and 0.99 is added. So a 299 payment becomes 299.42. This makes
          every QR unique — even if two customers pay the same item at the same
          time, the amounts are different, so verification can match exactly.
        </P>

        <SubHeading>SVG variant</SubHeading>
        <CodeBlock
          code={`import { createPaymentSvg } from "upiagent";

const payment = await createPaymentSvg(
  { upiId: "shop@ybl", name: "My Shop" },
  { amount: 299 }
);
// payment.qrDataUrl is now an SVG string`}
          lang="typescript"
          filename="create-svg.ts"
        />
      </section>

      {/* Verify payment */}
      <section className="mb-16">
        <SectionHeading id="verify-payment">Verify payment</SectionHeading>
        <P>
          There are two ways to verify. Use{" "}
          <InlineCode>fetchAndVerifyPayment()</InlineCode> to do everything in
          one call, or use <InlineCode>verifyPayment()</InlineCode> if you
          already have the email.
        </P>

        <SubHeading>Option A: Fetch + verify (recommended)</SubHeading>
        <P>
          Connects to Gmail, fetches recent bank alert emails, and checks each
          one against your expected payment.
        </P>
        <CodeBlock
          code={`import { fetchAndVerifyPayment } from "upiagent";

const result = await fetchAndVerifyPayment({
  gmail: {
    clientId: "your-client-id",
    clientSecret: "your-client-secret",
    refreshToken: "your-refresh-token",
  },
  llm: {
    provider: "gemini",
    model: "gemini-2.0-flash",
    apiKey: "your-gemini-key",
  },
  expected: {
    amount: 499,                  // exact amount to match
    timeWindowMinutes: 30,        // how far back to look (default: 30)
  },
  lookbackMinutes: 30,            // Gmail search window
  maxEmails: 10,                  // max emails to check
});

if (result.verified) {
  console.log(result.payment.senderName);       // "John Doe"
  console.log(result.payment.amount);           // 499
  console.log(result.payment.upiReferenceId);   // "412345678901"
  console.log(result.confidence);               // 0.95
}`}
          lang="typescript"
          filename="fetch-verify.ts"
        />

        <SubHeading>Option B: Verify a single email</SubHeading>
        <P>
          If you already have the email (e.g., from your own Gmail polling), pass
          it directly.
        </P>
        <CodeBlock
          code={`import { verifyPayment } from "upiagent";

const result = await verifyPayment(email, {
  llm: {
    provider: "gemini",
    model: "gemini-2.0-flash",
    apiKey: "your-gemini-key",
  },
  expected: { amount: 499 },
});`}
          lang="typescript"
          filename="verify-single.ts"
        />

        <SubHeading>What&apos;s in the result?</SubHeading>
        <CodeBlock
          code={`// VerificationResult
{
  verified: true,            // did it pass all 5 layers?
  payment: {
    amount: 499,
    senderName: "John Doe",
    senderUpiId: "john@ybl",
    upiReferenceId: "412345678901",
    bankName: "HDFC Bank",
    receivedAt: "2025-01-15T10:30:00Z",
  },
  confidence: 0.95,          // LLM confidence (0-1)
  failureReason: null,       // or "AMOUNT_MISMATCH", "DUPLICATE", etc.
  layerResults: [            // step-by-step breakdown
    { layer: "email_source", passed: true },
    { layer: "amount_match", passed: true },
    { layer: "time_window", passed: true },
    { layer: "llm_confidence", passed: true },
    { layer: "dedup", passed: true },
  ],
}`}
          lang="typescript"
          filename="result-shape.ts"
        />
      </section>

      {/* Security layers */}
      <section className="mb-16">
        <SectionHeading id="security-layers">Security layers</SectionHeading>
        <P>
          Every payment goes through 5 validation layers, in order. If any layer
          fails, verification stops immediately (fail-fast).
        </P>

        <div className="space-y-3 mb-6">
          {[
            {
              num: "1",
              title: "Email source",
              desc: "Is the email from a known bank? We check against a registry of bank email patterns (ICICI, HDFC, Axis, SBI, etc.). Blocks spoofed emails.",
            },
            {
              num: "2",
              title: "Amount match",
              desc: "Does the parsed amount match exactly? Default tolerance is 0% — even Re.1 off and it fails. You can set amountTolerancePercent if needed, but we recommend exact matching.",
            },
            {
              num: "3",
              title: "Time window",
              desc: "Was the payment within the lookback window? Default is 30 minutes. UPI settles in seconds, but bank emails can be delayed. This blocks old/stale emails from being replayed.",
            },
            {
              num: "4",
              title: "LLM confidence",
              desc: "How confident is the AI in its parsing? If the email was garbled or ambiguous, the confidence score drops and verification fails.",
            },
            {
              num: "5",
              title: "Deduplication",
              desc: "Has this exact transaction been verified before? Prevents double-crediting. Uses in-memory store by default, or Postgres for production.",
            },
          ].map((layer) => (
            <div
              key={layer.num}
              className="flex gap-4 py-4 px-5 rounded-xl border border-border"
            >
              <span className="w-6 h-6 rounded-full bg-accent-green/10 text-accent-green text-[12px] font-mono font-medium flex items-center justify-center shrink-0 mt-0.5">
                {layer.num}
              </span>
              <div>
                <p className="text-[14px] font-medium mb-1">{layer.title}</p>
                <p className="text-[13px] text-foreground/60 leading-6">
                  {layer.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <SubHeading>Postgres dedup (production)</SubHeading>
        <P>
          The default in-memory dedup store resets when your server restarts. For
          production, use the Postgres store:
        </P>
        <CodeBlock
          code={`import { fetchAndVerifyPayment, PostgresDedupStore } from "upiagent";

const dedup = new PostgresDedupStore(process.env.DATABASE_URL);

const result = await fetchAndVerifyPayment({
  // ... gmail, llm, expected
  dedup,
});`}
          lang="typescript"
          filename="postgres-dedup.ts"
        />
      </section>

      {/* Webhooks */}
      <section className="mb-16">
        <SectionHeading id="webhooks">Webhooks</SectionHeading>
        <P>
          Send HMAC-signed webhook notifications when payments are verified or
          expire. Includes automatic retries with exponential backoff.
        </P>

        <SubHeading>Sending webhooks</SubHeading>
        <CodeBlock
          code={`import { WebhookSender } from "upiagent";

const sender = new WebhookSender({
  url: "https://yourapp.com/webhooks/payment",
  secret: "whsec_your_secret_here",
});

// Send a payment.verified event
const delivery = await sender.send({
  event: "payment.verified",
  data: {
    paymentId: "txn_123",
    amount: 499,
    currency: "INR",
    status: "verified",
    upiReferenceId: "412345678901",
    senderName: "John Doe",
    confidence: 0.95,
  },
});

// delivery.delivered → true/false
// delivery.attempts  → number of attempts (retries on failure)`}
          lang="typescript"
          filename="send-webhook.ts"
        />

        <SubHeading>Receiving webhooks</SubHeading>
        <P>
          Verify the HMAC signature before processing:
        </P>
        <CodeBlock
          code={`import { verifyWebhookSignature } from "upiagent";

// In your webhook handler (Express, Next.js, etc.)
const signature = req.headers["x-upiagent-signature"];
const event = req.headers["x-upiagent-event"];
const body = await req.text();

const isValid = verifyWebhookSignature(body, signature, "whsec_your_secret");

if (!isValid) {
  return new Response("Invalid signature", { status: 401 });
}

// Safe to process
const payload = JSON.parse(body);
if (payload.event === "payment.verified") {
  // credit the customer
}`}
          lang="typescript"
          filename="receive-webhook.ts"
        />

        <SubHeading>Webhook headers</SubHeading>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4 font-mono font-medium text-foreground/70">
                  Header
                </th>
                <th className="py-2 font-medium text-foreground/70">Value</th>
              </tr>
            </thead>
            <tbody className="text-foreground/60">
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 font-mono">X-UpiAgent-Signature</td>
                <td className="py-2">HMAC-SHA256 hex digest</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 font-mono">X-UpiAgent-Event</td>
                <td className="py-2">payment.verified or payment.expired</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono">X-UpiAgent-Delivery-Id</td>
                <td className="py-2">Unique delivery ID for idempotency</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Gmail setup */}
      <section className="mb-16">
        <SectionHeading id="gmail-setup">Gmail setup</SectionHeading>
        <P>
          upiagent reads bank alert emails from your Gmail to detect incoming
          payments. You need a Google Cloud project with the Gmail API enabled.
        </P>

        <SubHeading>Option A: CLI setup wizard</SubHeading>
        <P>
          The fastest way. Run this and follow the prompts:
        </P>
        <CodeBlock code="npx upiagent setup" lang="bash" filename="terminal" />

        <SubHeading>Option B: Manual setup</SubHeading>
        <div className="space-y-2 mb-4">
          {[
            "Go to Google Cloud Console and create a new project",
            'Enable the Gmail API (search for "Gmail API" in the API library)',
            "Create OAuth 2.0 credentials (Desktop app type)",
            "Add your Gmail as a test user under the OAuth consent screen",
            'Set the redirect URI to "http://localhost:3000/auth/callback"',
            "Use the client ID and secret in your code",
          ].map((step, i) => (
            <div key={i} className="flex gap-3 text-[13px] text-foreground/70">
              <span className="text-muted font-mono shrink-0">{i + 1}.</span>
              <span className="leading-6">{step}</span>
            </div>
          ))}
        </div>

        <Callout>
          <strong>Tip:</strong> Your Gmail must be the one that receives bank
          alerts. This is the Gmail connected to your bank account (the one that
          gets &quot;You have received Rs.499 from...&quot; emails).
        </Callout>
      </section>

      {/* LLM providers */}
      <section className="mb-16">
        <SectionHeading id="llm-providers">LLM providers</SectionHeading>
        <P>
          upiagent uses AI to extract payment details (amount, sender, reference
          ID) from bank alert emails. Three providers are supported:
        </P>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4 font-medium text-foreground/70">Provider</th>
                <th className="py-2 pr-4 font-medium text-foreground/70">Model</th>
                <th className="py-2 pr-4 font-medium text-foreground/70">Cost</th>
                <th className="py-2 font-medium text-foreground/70">Config</th>
              </tr>
            </thead>
            <tbody className="text-foreground/60">
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4">Google Gemini</td>
                <td className="py-2 pr-4 font-mono">gemini-2.0-flash</td>
                <td className="py-2 pr-4 text-accent-green font-medium">Free</td>
                <td className="py-2 font-mono">GEMINI_API_KEY</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4">OpenAI</td>
                <td className="py-2 pr-4 font-mono">gpt-4o-mini</td>
                <td className="py-2 pr-4">Paid</td>
                <td className="py-2 font-mono">OPENAI_API_KEY</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Anthropic</td>
                <td className="py-2 pr-4 font-mono">claude-3-haiku</td>
                <td className="py-2 pr-4">Paid</td>
                <td className="py-2 font-mono">ANTHROPIC_API_KEY</td>
              </tr>
            </tbody>
          </table>
        </div>

        <P>
          We default to Gemini because it&apos;s free and fast enough for
          parsing bank emails. You or your merchants can bring their own keys
          for any provider.
        </P>

        <CodeBlock
          code={`// Gemini (free, default)
llm: { provider: "gemini", model: "gemini-2.0-flash", apiKey: "..." }

// OpenAI
llm: { provider: "openai", model: "gpt-4o-mini", apiKey: "..." }

// Anthropic
llm: { provider: "anthropic", model: "claude-3-haiku-20240307", apiKey: "..." }`}
          lang="typescript"
          filename="llm-config.ts"
        />
      </section>

      {/* API reference */}
      <section className="mb-16">
        <SectionHeading id="api-reference">API reference</SectionHeading>

        <SubHeading>createPayment(merchant, options)</SubHeading>
        <P>Generate a UPI QR code for a payment.</P>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4 font-mono font-medium text-foreground/70">
                  Param
                </th>
                <th className="py-2 pr-4 font-medium text-foreground/70">Type</th>
                <th className="py-2 font-medium text-foreground/70">Description</th>
              </tr>
            </thead>
            <tbody className="text-foreground/60">
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 font-mono">merchant.upiId</td>
                <td className="py-2 pr-4 font-mono">string</td>
                <td className="py-2">Your UPI ID (e.g., &quot;shop@ybl&quot;)</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 font-mono">merchant.name</td>
                <td className="py-2 pr-4 font-mono">string</td>
                <td className="py-2">Display name in UPI app</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 font-mono">options.amount</td>
                <td className="py-2 pr-4 font-mono">number</td>
                <td className="py-2">Amount in INR</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 font-mono">options.addPaisa</td>
                <td className="py-2 pr-4 font-mono">boolean?</td>
                <td className="py-2">Add random paisa for unique matching (default: false)</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 font-mono">options.transactionId</td>
                <td className="py-2 pr-4 font-mono">string?</td>
                <td className="py-2">Your reference ID (auto-generated if omitted)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono">options.note</td>
                <td className="py-2 pr-4 font-mono">string?</td>
                <td className="py-2">Note shown in UPI app</td>
              </tr>
            </tbody>
          </table>
        </div>
        <P>
          Returns a <InlineCode>PaymentRequest</InlineCode> with{" "}
          <InlineCode>qrDataUrl</InlineCode>,{" "}
          <InlineCode>intentUrl</InlineCode>,{" "}
          <InlineCode>transactionId</InlineCode>, and{" "}
          <InlineCode>amount</InlineCode>.
        </P>

        <SubHeading>fetchAndVerifyPayment(options)</SubHeading>
        <P>Fetch bank alert emails from Gmail and verify against expected payment.</P>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4 font-mono font-medium text-foreground/70">
                  Param
                </th>
                <th className="py-2 pr-4 font-medium text-foreground/70">Type</th>
                <th className="py-2 font-medium text-foreground/70">Description</th>
              </tr>
            </thead>
            <tbody className="text-foreground/60">
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 font-mono">gmail</td>
                <td className="py-2 pr-4 font-mono">GmailCredentials</td>
                <td className="py-2">clientId, clientSecret, refreshToken</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 font-mono">llm</td>
                <td className="py-2 pr-4 font-mono">LlmConfig</td>
                <td className="py-2">provider, model, apiKey</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 font-mono">expected.amount</td>
                <td className="py-2 pr-4 font-mono">number</td>
                <td className="py-2">Amount to match</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 font-mono">expected.timeWindowMinutes</td>
                <td className="py-2 pr-4 font-mono">number?</td>
                <td className="py-2">Max age of payment (default: 30)</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4 font-mono">lookbackMinutes</td>
                <td className="py-2 pr-4 font-mono">number?</td>
                <td className="py-2">Gmail search window (default: 30)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono">dedup</td>
                <td className="py-2 pr-4 font-mono">DedupStore?</td>
                <td className="py-2">InMemoryDedupStore or PostgresDedupStore</td>
              </tr>
            </tbody>
          </table>
        </div>
        <P>
          Returns a <InlineCode>VerificationResult</InlineCode> — see the
          &quot;Verify payment&quot; section above for the full shape.
        </P>

        <SubHeading>WebhookSender</SubHeading>
        <P>
          Create with <InlineCode>{"new WebhookSender({ url, secret })"}</InlineCode>.
          Call <InlineCode>.send(payload)</InlineCode> to deliver. Retries
          automatically (3 attempts with 1s, 5s, 25s delays).
        </P>

        <SubHeading>verifyWebhookSignature(body, signature, secret)</SubHeading>
        <P>
          Returns <InlineCode>true</InlineCode> if the HMAC-SHA256 signature
          matches. Use this in your webhook handler to verify the request is
          from upiagent.
        </P>
      </section>

      {/* Error handling */}
      <section className="mb-16">
        <SectionHeading id="error-handling">Error handling</SectionHeading>
        <P>
          upiagent throws typed errors you can catch and handle specifically:
        </P>
        <CodeBlock
          code={`import {
  GmailAuthError,
  GmailRateLimitError,
  LlmError,
  LlmRateLimitError,
  LlmBudgetExceededError,
  ConfigError,
} from "upiagent";

try {
  const result = await fetchAndVerifyPayment({ ... });
} catch (err) {
  if (err instanceof GmailAuthError) {
    // Gmail OAuth token expired — re-authenticate
  }
  if (err instanceof GmailRateLimitError) {
    // Gmail API rate limit — back off and retry
  }
  if (err instanceof LlmError) {
    // LLM API call failed — check your API key
  }
  if (err instanceof LlmRateLimitError) {
    // LLM rate limit — use the built-in LlmRateLimiter
  }
  if (err instanceof LlmBudgetExceededError) {
    // Token budget exceeded — use CostTracker to set limits
  }
}`}
          lang="typescript"
          filename="errors.ts"
        />

        <Callout type="warning">
          <strong>Non-error failures</strong> (amount mismatch, duplicate, etc.)
          don&apos;t throw. They return a{" "}
          <InlineCode>VerificationResult</InlineCode> with{" "}
          <InlineCode>verified: false</InlineCode> and a{" "}
          <InlineCode>failureReason</InlineCode> code. Only infrastructure
          failures (auth, rate limits, network) throw errors.
        </Callout>
      </section>

      {/* Examples */}
      <section className="mb-16">
        <SectionHeading id="examples">Examples</SectionHeading>

        <SubHeading>Next.js API route</SubHeading>
        <CodeBlock
          code={`// app/api/create-payment/route.ts
import { createPayment } from "upiagent";

export async function POST(req: Request) {
  const { amount, note } = await req.json();

  const payment = await createPayment(
    { upiId: process.env.UPI_ID!, name: "My Store" },
    { amount, note, addPaisa: true }
  );

  return Response.json({
    qrDataUrl: payment.qrDataUrl,
    transactionId: payment.transactionId,
    amount: payment.amount,
  });
}`}
          lang="typescript"
          filename="app/api/create-payment/route.ts"
        />

        <SubHeading>Express server</SubHeading>
        <CodeBlock
          code={`import express from "express";
import { createPayment, fetchAndVerifyPayment } from "upiagent";

const app = express();
app.use(express.json());

app.post("/pay", async (req, res) => {
  const payment = await createPayment(
    { upiId: "shop@ybl", name: "My Shop" },
    { amount: req.body.amount, addPaisa: true }
  );
  res.json(payment);
});

app.post("/verify", async (req, res) => {
  const result = await fetchAndVerifyPayment({
    gmail: { /* credentials */ },
    llm: { provider: "gemini", model: "gemini-2.0-flash", apiKey: "..." },
    expected: { amount: req.body.amount },
  });
  res.json({ verified: result.verified, payment: result.payment });
});

app.listen(3000);`}
          lang="typescript"
          filename="server.ts"
        />

        <SubHeading>Webhook receiver (Next.js)</SubHeading>
        <CodeBlock
          code={`// app/api/webhooks/payment/route.ts
import { verifyWebhookSignature } from "upiagent";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-upiagent-signature")!;

  if (!verifyWebhookSignature(body, signature, process.env.WEBHOOK_SECRET!)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(body);

  if (payload.event === "payment.verified") {
    // Update order status, send confirmation email, etc.
    console.log("Payment verified:", payload.data.paymentId);
  }

  return new Response("ok");
}`}
          lang="typescript"
          filename="app/api/webhooks/payment/route.ts"
        />
      </section>

      {/* Bottom CTA */}
      <section className="mb-8 text-center py-12 border-t border-border">
        <p className="font-mono text-[13px] text-muted mb-3">
          Ready to start?
        </p>
        <code className="inline-block px-6 py-3 rounded-xl bg-foreground text-background font-mono text-[14px]">
          npm install upiagent
        </code>
        <div className="flex items-center justify-center gap-6 mt-6">
          <a
            href="https://github.com/AmarPathak/upiagent"
            className="text-[13px] text-muted hover:text-foreground transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://www.npmjs.com/package/upiagent"
            className="text-[13px] text-muted hover:text-foreground transition-colors"
          >
            npm
          </a>
          <a
            href="https://github.com/AmarPathak/upiagent/issues"
            className="text-[13px] text-muted hover:text-foreground transition-colors"
          >
            Report a bug
          </a>
        </div>
      </section>
    </article>
  );
}

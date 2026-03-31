"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function Code({ title, lang, code }: { title: string; lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-[#0a0a0a] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
        <span className="text-xs text-muted-foreground font-mono">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/50 font-mono uppercase">{lang}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="text-[10px] text-muted-foreground font-mono hover:text-foreground transition-colors px-2 py-0.5 rounded border border-border"
          >
            {copied ? "copied!" : "copy"}
          </button>
        </div>
      </div>
      <pre className="p-4 overflow-x-auto"><code className="text-[13px] leading-6 font-mono text-foreground/80">{code}</code></pre>
    </div>
  );
}

function Ep({ method, path, desc }: { method: string; path: string; desc: string }) {
  const color = method === "POST" ? "bg-green-500/15 text-green-400" : "bg-blue-500/15 text-blue-400";
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
      <Badge className={`${color} font-mono text-[10px] shrink-0`}>{method}</Badge>
      <div>
        <code className="text-sm font-mono text-foreground">{path}</code>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export function DocsContent({ merchantId, apiKeyPrefix, upiId }: { merchantId: string; apiKeyPrefix: string; upiId: string }) {
  const url = "http://localhost:3002";

  const nav = [
    ["quickstart", "Quick Start"],
    ["auth", "Authentication"],
    ["create", "Create Payment"],
    ["status", "Check Status"],
    ["webhooks", "Webhooks"],
    ["nextjs", "Next.js"],
    ["embed", "Embed Widget"],
    ["curl", "cURL"],
    ["npm", "npm Package"],
    ["limits", "Limitations"],
  ];

  return (
    <div className="flex gap-8">
      <nav className="hidden lg:block w-40 shrink-0 sticky top-20 h-fit">
        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          {nav.map(([id, label]) => (
            <li key={id}><a href={`#${id}`} className="hover:text-foreground transition-colors">{label}</a></li>
          ))}
        </ul>
      </nav>

      <div className="flex-1 flex flex-col gap-10 max-w-3xl">

        {/* Quick Start */}
        <section id="quickstart">
          <h2 className="text-lg font-semibold mb-4">Quick Start</h2>
          <p className="text-sm text-muted-foreground mb-4">Three API calls. Create → Show QR → Verify.</p>
          <Code title="quick-start.sh" lang="bash" code={`# 1. Create payment
curl -X POST ${url}/api/v1/payments \\
  -H "Authorization: Bearer ${apiKeyPrefix}..." \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 499, "note": "Order #123", "addPaisa": true}'

# 2. Show qrDataUrl to customer as <img src={qrDataUrl} />

# 3. Poll for verification
curl ${url}/api/v1/payments/\${PAYMENT_ID} \\
  -H "Authorization: Bearer ${apiKeyPrefix}..."`} />
        </section>

        <Separator />

        {/* Auth */}
        <section id="auth">
          <h2 className="text-lg font-semibold mb-4">Authentication</h2>
          <p className="text-sm text-muted-foreground mb-4">
            All API requests need a Bearer token. Create one in <a href="/dashboard/api-keys" className="text-foreground underline">API Keys</a>.
          </p>
          <Code title="header" lang="http" code={`Authorization: Bearer ${apiKeyPrefix}...`} />
        </section>

        <Separator />

        {/* Create Payment */}
        <section id="create">
          <h2 className="text-lg font-semibold mb-4">Create Payment</h2>
          <Ep method="POST" path="/api/v1/payments" desc="Create a payment request with QR code" />
          <div className="mt-4" />
          <Code title="create-payment.ts" lang="typescript" code={`const res = await fetch("${url}/api/v1/payments", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKeyPrefix}...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount: 499,        // INR
    note: "Order #123", // shown in UPI app
    addPaisa: true,     // ₹499 → ₹499.37 (unique per QR)
  }),
});

const payment = await res.json();
// payment.qrDataUrl   → base64 PNG for <img>
// payment.intentUrl   → upi://pay?... for mobile
// payment.amount      → actual amount (499.37)
// payment.id          → use to check status`} />
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-sm">Response</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs font-mono text-muted-foreground leading-5">{`{
  "id": "uuid",
  "transactionId": "TXN_m4x7k2_a1b2c3",
  "amount": 499.37,
  "intentUrl": "upi://pay?pa=${upiId}&am=499.37&...",
  "qrDataUrl": "data:image/png;base64,...",
  "status": "pending",
  "expiresAt": "2026-03-31T13:35:00Z"
}`}</pre>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Check Status */}
        <section id="status">
          <h2 className="text-lg font-semibold mb-4">Check Payment Status</h2>
          <Ep method="GET" path="/api/v1/payments/:id" desc="Get payment status and verification details" />
          <div className="mt-4" />
          <Code title="poll-status.ts" lang="typescript" code={`// Poll every 10s until verified or expired
const check = async (id: string) => {
  const res = await fetch(\`${url}/api/v1/payments/\${id}\`, {
    headers: { "Authorization": "Bearer ${apiKeyPrefix}..." },
  });
  const p = await res.json();

  if (p.status === "verified") {
    console.log("Paid!", p.upiReferenceId, p.senderName);
  }
  // status: "pending" | "verified" | "failed" | "expired"
};`} />
        </section>

        <Separator />

        {/* Webhooks */}
        <section id="webhooks">
          <h2 className="text-lg font-semibold mb-4">Webhooks</h2>
          <p className="text-sm text-muted-foreground mb-4">Set your webhook URL in <a href="/dashboard/settings" className="text-foreground underline">Settings</a>. We POST when payments are verified.</p>
          <Code title="webhook-payload.json" lang="json" code={`{
  "event": "payment.verified",
  "data": {
    "id": "uuid",
    "transactionId": "TXN_xxx",
    "amount": 499.37,
    "upiReferenceId": "003538060093",
    "senderName": "JOHN DOE",
    "bankName": "HDFC Bank",
    "confidence": 0.95
  }
}

// Signature header for verification:
// X-UpiAgent-Signature: sha256=<HMAC>`} />
          <div className="mt-4" />
          <Code title="verify-webhook.ts" lang="typescript" code={`import crypto from "crypto";

function verifySignature(body: string, sig: string, secret: string) {
  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}`} />
        </section>

        <Separator />

        {/* Next.js */}
        <section id="nextjs">
          <h2 className="text-lg font-semibold mb-4">Next.js Integration</h2>
          <Code title="app/api/pay/route.ts" lang="typescript" code={`export async function POST(req: Request) {
  const { amount, orderId } = await req.json();

  const res = await fetch("${url}/api/v1/payments", {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${process.env.UPIAGENT_API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount, note: \`Order \${orderId}\`, addPaisa: true }),
  });

  return Response.json(await res.json());
}`} />
          <div className="mt-4" />
          <Code title="components/checkout.tsx" lang="tsx" code={`"use client";
import { useState } from "react";

export function Checkout({ amount }: { amount: number }) {
  const [payment, setPayment] = useState<any>(null);
  const [status, setStatus] = useState("idle");

  async function pay() {
    const res = await fetch("/api/pay", {
      method: "POST",
      body: JSON.stringify({ amount, orderId: "ORD_123" }),
    });
    const data = await res.json();
    setPayment(data);
    setStatus("pending");

    // Poll every 10s
    const i = setInterval(async () => {
      const r = await fetch(\`/api/pay/\${data.id}\`);
      const d = await r.json();
      if (d.status === "verified") { clearInterval(i); setStatus("verified"); }
      if (d.status === "expired") { clearInterval(i); setStatus("expired"); }
    }, 10000);
  }

  if (status === "idle") return <button onClick={pay}>Pay ₹{amount}</button>;
  if (status === "pending") return (
    <div>
      <img src={payment.qrDataUrl} alt="Scan to pay" />
      <a href={payment.intentUrl}>Open UPI App</a>
      <p>Waiting for payment...</p>
    </div>
  );
  if (status === "verified") return <p>✓ Payment confirmed!</p>;
  return <p>Payment expired. Try again.</p>;
}`} />
        </section>

        <Separator />

        {/* Embed */}
        <section id="embed">
          <h2 className="text-lg font-semibold mb-4">Embed Widget</h2>
          <p className="text-sm text-muted-foreground mb-4">Drop this on any HTML page — no React required.</p>
          <Code title="embed.html" lang="html" code={`<script src="https://upiagent.dev/embed.js" defer></script>
<div
  data-upiagent
  data-merchant="${merchantId}"
  data-amount="499"
  data-note="Order #123"
  data-add-paisa="true"
></div>`} />
        </section>

        <Separator />

        {/* cURL */}
        <section id="curl">
          <h2 className="text-lg font-semibold mb-4">cURL Examples</h2>
          <Code title="full-flow.sh" lang="bash" code={`# Create payment
PAYMENT=$(curl -s -X POST ${url}/api/v1/payments \\
  -H "Authorization: Bearer ${apiKeyPrefix}..." \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 100, "addPaisa": true}')

echo $PAYMENT | jq .

# Extract ID
ID=$(echo $PAYMENT | jq -r .id)

# Check status
curl -s ${url}/api/v1/payments/$ID \\
  -H "Authorization: Bearer ${apiKeyPrefix}..." | jq .status`} />
        </section>

        <Separator />

        {/* npm */}
        <section id="npm">
          <h2 className="text-lg font-semibold mb-4">Self-Hosted (npm)</h2>
          <p className="text-sm text-muted-foreground mb-4">Use the open-source package without the SaaS.</p>
          <Code title="install" lang="bash" code="npm install upiagent" />
          <div className="mt-4" />
          <Code title="usage.ts" lang="typescript" code={`import { UpiAgent } from "upiagent";

const agent = new UpiAgent({
  merchant: { upiId: "${upiId}", name: "My Shop" },
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID!,
    clientSecret: process.env.GMAIL_CLIENT_SECRET!,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN!,
  },
  llm: { provider: "gemini", apiKey: process.env.GEMINI_KEY! },
});

const payment = await agent.createPayment({ amount: 499, addPaisa: true });
// Show payment.qrDataUrl to customer

const result = await agent.verifyPayment({ expectedAmount: payment.amount });
console.log(result.verified, result.payment?.upiReferenceId);`} />
        </section>

        <Separator />

        {/* Limitations */}
        <section id="limits">
          <h2 className="text-lg font-semibold mb-4">Limitations & Scale</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="shrink-0 mt-0.5">Current</Badge>
                  <p className="text-muted-foreground">~50 concurrent payments per price point. Uses amount matching with addPaisa. Best for small-medium merchants.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="shrink-0 mt-0.5 text-yellow-500 border-yellow-500/30">Planned</Badge>
                  <p className="text-muted-foreground">Virtual accounts for 1:1 matching. Unlimited concurrent payments. Coming in Phase 3.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="shrink-0 mt-0.5 text-cyan-500 border-cyan-500/30">Future</Badge>
                  <p className="text-muted-foreground">UPI Collect API with RBI PA license. Instant verification, unlimited scale.</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground mt-3">
            Full details: <a href="https://github.com/AmarPathak/upiagent/blob/main/docs/limitations-and-roadmap.md" className="underline">limitations-and-roadmap.md</a>
          </p>
        </section>
      </div>
    </div>
  );
}

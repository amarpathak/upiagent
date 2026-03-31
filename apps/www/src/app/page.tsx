import { Terminal } from "@/components/terminal";
import { CodeBlock } from "@/components/code-block";
import { SecurityLayer } from "@/components/security-layer";
import { LiveDemo } from "@/components/live-demo";

const quickStart = `import { UpiAgent } from "upiagent"

const agent = new UpiAgent({
  merchant: { upiId: "shop@ybl", name: "My Shop" },
  gmail: { clientId: "...", clientSecret: "...", refreshToken: "..." },
  llm: { provider: "openai", apiKey: process.env.OPENAI_KEY },
})

// Generate QR → customer scans → pays via any UPI app
const payment = await agent.createPayment({
  amount: 499,
  note: "Order #2847",
})

// Verify: reads Gmail bank alerts, LLM extracts payment data
const result = await agent.verifyPayment({
  expectedAmount: 499,
})

result.verified          // true
result.payment.upiReferenceId  // "412345678901"
result.confidence        // 0.95`;

const nextjsCode = `// app/api/pay/route.ts
import { UpiAgent } from "upiagent"

const agent = new UpiAgent({ /* config */ })

export async function POST(req: Request) {
  const { amount, orderId } = await req.json()
  const payment = await agent.createPayment({ amount, note: orderId })
  return Response.json(payment)
}`;

const securityLayers = [
  {
    num: "01",
    name: "Format Validation",
    desc: "Zod schema catches LLM hallucinations before they enter your system",
  },
  {
    num: "02",
    name: "Amount Matching",
    desc: "Exact match to the paisa. No fuzzy matching on financial data.",
  },
  {
    num: "03",
    name: "Time Window",
    desc: "Configurable window blocks replay attacks from stale emails",
  },
  {
    num: "04",
    name: "Duplicate Detection",
    desc: "UPI reference ID tracking prevents double-crediting",
  },
];

export default function Home() {
  return (
    <main className="flex flex-col">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-6">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(var(--muted) 1px, transparent 1px), linear-gradient(90deg, var(--muted) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        <div className="relative z-10 max-w-3xl w-full">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs font-mono text-muted mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              v0.1.0 — open source
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
              UPI payments
              <br />
              <span className="text-muted">without a gateway.</span>
            </h1>

            <p className="mt-6 text-lg text-muted max-w-xl leading-relaxed">
              Generate QR codes. Customers pay via any UPI app.
              Verify payments through Gmail bank alerts + LLM parsing.
              No Razorpay. No fees. No merchant onboarding.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-12">
            <a
              href="https://github.com/AmarPathak/upiagent"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-foreground text-background font-medium text-sm rounded-md hover:bg-foreground/90 transition-colors"
            >
              View on GitHub
            </a>
            <a
              href="#quickstart"
              className="inline-flex items-center justify-center px-5 py-2.5 border border-border text-sm font-medium rounded-md hover:bg-surface transition-colors"
            >
              Get started
            </a>
          </div>

          <Terminal />
        </div>
      </section>

      {/* ── Live Demo ────────────────────────────────────── */}
      <section id="demo" className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-mono text-xs text-muted uppercase tracking-widest mb-2">
            Try it
          </h2>
          <p className="text-2xl font-semibold tracking-tight mb-8">
            Live demo. Real UPI QR code.
          </p>
          <LiveDemo />
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-mono text-xs text-muted uppercase tracking-widest mb-2">
            How it works
          </h2>
          <p className="text-2xl font-semibold tracking-tight mb-12">
            Three lines of intent. Zero payment infrastructure.
          </p>

          <div className="grid gap-8">
            <Step
              num="01"
              title="Generate a UPI QR"
              desc="Standard UPI intent URL rendered as a QR code. Works with GPay, PhonePe, Paytm, CRED — any UPI app."
            />
            <Step
              num="02"
              title="Customer scans & pays"
              desc="Payment happens entirely in the customer's UPI app. Your server never touches their banking credentials."
            />
            <Step
              num="03"
              title="Verify via Gmail + LLM"
              desc="upiagent reads your bank's email alerts, uses an LLM to extract payment data, and validates it through a 4-layer security pipeline."
            />
          </div>
        </div>
      </section>

      {/* ── Code ─────────────────────────────────────────── */}
      <section id="quickstart" className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-mono text-xs text-muted uppercase tracking-widest mb-2">
            Quick start
          </h2>
          <p className="text-2xl font-semibold tracking-tight mb-8">
            Install. Configure. Ship.
          </p>

          <CodeBlock code="npm install upiagent" lang="bash" filename="terminal" />
          <div className="mt-4">
            <CodeBlock code={quickStart} lang="typescript" filename="app.ts" />
          </div>
        </div>
      </section>

      {/* ── Security ─────────────────────────────────────── */}
      <section className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-mono text-xs text-muted uppercase tracking-widest mb-2">
            Security
          </h2>
          <p className="text-2xl font-semibold tracking-tight mb-4">
            Defense-in-depth. Not an afterthought.
          </p>
          <p className="text-muted mb-12 max-w-xl">
            Every LLM-parsed payment runs through four validation layers.
            Each catches a different class of attack.
          </p>

          <div className="grid gap-3">
            {securityLayers.map((layer) => (
              <SecurityLayer key={layer.num} {...layer} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Why LLM ──────────────────────────────────────── */}
      <section className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-mono text-xs text-muted uppercase tracking-widest mb-2">
            Why LLM, not regex
          </h2>
          <p className="text-2xl font-semibold tracking-tight mb-8">
            Banks change email templates. Your code shouldn&apos;t break.
          </p>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="p-5 rounded-lg border border-border bg-surface">
              <div className="font-mono text-xs text-red-400 mb-3">regex approach</div>
              <p className="text-sm text-muted leading-relaxed">
                One pattern per bank, per format variation. HDFC changes their
                template — your parser breaks silently. SBI sends Hindi emails
                — no match.
              </p>
            </div>
            <div className="p-5 rounded-lg border border-accent/30 bg-accent/[0.03]">
              <div className="font-mono text-xs text-accent mb-3">upiagent</div>
              <p className="text-sm text-muted leading-relaxed">
                The LLM reads the email like a human. Any bank, any format,
                any language. Template changes? Zero code changes. Zod ensures
                type safety.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Next.js ──────────────────────────────────────── */}
      <section className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-mono text-xs text-muted uppercase tracking-widest mb-2">
            Framework ready
          </h2>
          <p className="text-2xl font-semibold tracking-tight mb-8">
            Drops into any Node.js backend.
          </p>

          <CodeBlock code={nextjsCode} lang="typescript" filename="app/api/pay/route.ts" />
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────── */}
      <section className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-mono text-xs text-muted uppercase tracking-widest mb-2">
            Cost
          </h2>
          <p className="text-2xl font-semibold tracking-tight mb-8">
            Pennies per verification.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 font-mono text-xs text-muted font-normal">Model</th>
                  <th className="pb-3 font-mono text-xs text-muted font-normal">Per verification</th>
                  <th className="pb-3 font-mono text-xs text-muted font-normal">1,000 verifications</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr className="border-b border-border/50">
                  <td className="py-3">gpt-4o-mini</td>
                  <td className="py-3 text-accent">~$0.0001</td>
                  <td className="py-3 text-muted">~$0.10</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3">gpt-4o</td>
                  <td className="py-3">~$0.005</td>
                  <td className="py-3 text-muted">~$5.00</td>
                </tr>
                <tr>
                  <td className="py-3">claude-sonnet</td>
                  <td className="py-3">~$0.007</td>
                  <td className="py-3 text-muted">~$7.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-xs text-muted">
            Compare: Razorpay charges 2% per transaction. On ₹499, that&apos;s ₹9.98.
            upiagent costs ₹0.008 with gpt-4o-mini.
          </p>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-2xl font-semibold tracking-tight mb-4">
            Start accepting UPI payments in 5 minutes.
          </p>
          <p className="text-muted mb-8">
            Open source. MIT licensed. Self-host or use our managed API.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://github.com/AmarPathak/upiagent"
              className="inline-flex items-center justify-center px-6 py-3 bg-foreground text-background font-medium text-sm rounded-md hover:bg-foreground/90 transition-colors"
            >
              GitHub
            </a>
            <a
              href="#quickstart"
              className="inline-flex items-center justify-center px-6 py-3 border border-border text-sm font-medium rounded-md hover:bg-surface transition-colors"
            >
              Documentation
            </a>
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 border-t border-border">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-xs text-muted font-mono">
          <span>upiagent</span>
          <span>MIT license</span>
        </div>
      </footer>
    </main>
  );
}

function Step({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="flex gap-5">
      <div className="font-mono text-xs text-accent pt-1 shrink-0">{num}</div>
      <div>
        <div className="font-semibold mb-1">{title}</div>
        <p className="text-sm text-muted leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

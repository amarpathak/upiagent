import { Terminal } from "@/components/terminal";
import { CodeBlock } from "@/components/code-block";
import { SecurityLayer } from "@/components/security-layer";
import { LiveDemo } from "@/components/live-demo";
import { GridBackground } from "@/components/grid-background";
import { AnimatedFlow } from "@/components/animated-flow";

const quickStart = `import { UpiAgent } from "upiagent"

const agent = new UpiAgent({
  merchant: { upiId: "shop@ybl", name: "My Shop" },
  gmail: { clientId: "...", clientSecret: "...", refreshToken: "..." },
  llm: { provider: "openai", apiKey: process.env.OPENAI_KEY },
})

// Generate QR — customer scans — pays via any UPI app
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
      <section className="relative min-h-[90vh] flex items-center justify-center px-6 overflow-hidden">
        <GridBackground />

        {/* Radial gradient fade */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 50%, transparent, var(--background) 70%)",
          }}
        />

        <div className="relative z-10 max-w-3xl w-full">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-xs font-mono text-muted mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
              v0.1.0 &middot; open source
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.08]">
              UPI payments
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-cyan">
                without a gateway.
              </span>
            </h1>

            <p className="mt-6 text-lg text-muted max-w-xl leading-relaxed">
              Generate QR codes. Customers pay via any UPI app.
              Verify payments through Gmail bank alerts + LLM parsing.
              No Razorpay. No fees. No merchant onboarding.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-12">
            <a
              href="/signup"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-foreground text-background font-medium text-sm rounded-md hover:bg-foreground/90 transition-colors"
            >
              Get started
              <svg className="ml-2 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
            <a
              href="https://github.com/AmarPathak/upiagent"
              className="inline-flex items-center justify-center px-5 py-2.5 border border-border text-foreground/70 text-sm font-medium rounded-md hover:bg-surface-raised hover:text-foreground transition-colors"
            >
              <svg className="mr-2 w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </a>
          </div>

          <Terminal />
        </div>
      </section>

      {/* ── How it works — animated flow ─────────────────── */}
      <section className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <p className="font-mono text-xs text-muted uppercase tracking-widest mb-2">
            How it works
          </p>
          <p className="text-2xl font-semibold tracking-tight mb-4">
            Three steps. Zero payment infrastructure.
          </p>

          <AnimatedFlow />

          <div className="grid gap-6 mt-4">
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
              title="Verify via LLM"
              desc="upiagent ingests bank alerts from Gmail, SMS, WhatsApp, or screenshots — an LLM extracts payment data and validates it through a 4-layer security pipeline."
            />
          </div>
        </div>
      </section>

      {/* ── Live Demo ────────────────────────────────────── */}
      <section id="demo" className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <p className="font-mono text-xs text-muted uppercase tracking-widest mb-2">
            Try it
          </p>
          <p className="text-2xl font-semibold tracking-tight mb-8">
            Live demo. Real UPI QR code.
          </p>
          <LiveDemo />
        </div>
      </section>

      {/* ── Quick Start ─────────────────────────────────── */}
      <section id="quickstart" className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <p className="font-mono text-xs text-muted uppercase tracking-widest mb-2">
            Quick start
          </p>
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
          <p className="font-mono text-xs text-muted uppercase tracking-widest mb-2">
            Security
          </p>
          <p className="text-2xl font-semibold tracking-tight mb-4">
            Defense-in-depth. Not an afterthought.
          </p>
          <p className="text-muted text-sm mb-10 max-w-lg leading-relaxed">
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
          <p className="font-mono text-xs text-muted uppercase tracking-widest mb-2">
            Why LLM, not regex
          </p>
          <p className="text-2xl font-semibold tracking-tight mb-8">
            Banks change email templates. Your code shouldn&apos;t break.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-lg border border-border bg-surface">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-red-500/60" />
                <span className="font-mono text-xs text-muted">regex approach</span>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                One pattern per bank, per format variation. HDFC changes their
                template — your parser breaks silently. SBI sends Hindi emails
                — no match.
              </p>
            </div>
            <div className="p-5 rounded-lg border border-accent/20 bg-accent/[0.03]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-cyan" />
                <span className="font-mono text-xs text-foreground/70">upiagent</span>
              </div>
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
          <p className="font-mono text-xs text-muted uppercase tracking-widest mb-2">
            Framework ready
          </p>
          <p className="text-2xl font-semibold tracking-tight mb-8">
            Drops into any Node.js backend.
          </p>

          <CodeBlock code={nextjsCode} lang="typescript" filename="app/api/pay/route.ts" />
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────── */}
      <section className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <p className="font-mono text-xs text-muted uppercase tracking-widest mb-2">
            Cost
          </p>
          <p className="text-2xl font-semibold tracking-tight mb-8">
            Pennies per verification.
          </p>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-raised text-left">
                  <th className="px-4 py-3 font-mono text-xs text-muted font-normal">Model</th>
                  <th className="px-4 py-3 font-mono text-xs text-muted font-normal">Per verification</th>
                  <th className="px-4 py-3 font-mono text-xs text-muted font-normal">1,000 verifications</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr className="border-b border-border">
                  <td className="px-4 py-3 text-foreground/80">gpt-4o-mini</td>
                  <td className="px-4 py-3 text-cyan">~$0.0001</td>
                  <td className="px-4 py-3 text-muted">~$0.10</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-4 py-3 text-foreground/80">gpt-4o</td>
                  <td className="px-4 py-3 text-foreground/60">~$0.005</td>
                  <td className="px-4 py-3 text-muted">~$5.00</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-foreground/80">claude-sonnet</td>
                  <td className="px-4 py-3 text-foreground/60">~$0.007</td>
                  <td className="px-4 py-3 text-muted">~$7.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-muted">
            Compare: Razorpay charges 2% per transaction. On &#8377;499, that&apos;s &#8377;9.98.
            upiagent costs &#8377;0.008 with gpt-4o-mini.
          </p>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="relative px-6 py-24 border-t border-border overflow-hidden">
        {/* Subtle gradient bg */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 50% 60% at 50% 100%, rgba(59,130,246,0.08), transparent)",
          }}
        />

        <div className="relative max-w-3xl mx-auto text-center">
          <p className="text-2xl font-semibold tracking-tight mb-4">
            Start accepting UPI payments in 5 minutes.
          </p>
          <p className="text-muted mb-8 text-sm">
            Open source. MIT licensed. Self-host or use our managed API.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/signup"
              className="inline-flex items-center justify-center px-6 py-3 bg-foreground text-background font-medium text-sm rounded-md hover:bg-foreground/90 transition-colors"
            >
              Get started free
            </a>
            <a
              href="https://github.com/AmarPathak/upiagent"
              className="inline-flex items-center justify-center px-6 py-3 border border-border text-foreground/70 text-sm font-medium rounded-md hover:bg-surface-raised hover:text-foreground transition-colors"
            >
              Read the docs
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
    <div className="flex gap-4 items-start">
      <div className="w-8 h-8 rounded-md border border-border bg-surface-raised flex items-center justify-center font-mono text-xs text-muted shrink-0">
        {num}
      </div>
      <div>
        <div className="font-medium mb-1 text-foreground">{title}</div>
        <p className="text-sm text-muted leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

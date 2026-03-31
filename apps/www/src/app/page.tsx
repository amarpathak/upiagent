import { Terminal } from "@/components/terminal";
import { CodeBlock } from "@/components/code-block";
import { SecurityLayer } from "@/components/security-layer";
import { LiveDemo } from "@/components/live-demo";
import { HeroCanvas } from "@/components/hero-canvas";
import { AnimatedFlow } from "@/components/animated-flow";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001";

const installCode = `npm install upiagent`;

const quickStart = `import { UpiAgent } from "upiagent"

const agent = new UpiAgent({
  merchant: { upiId: "you@ybl", name: "Your Store" },
  gmail: { clientId: "...", clientSecret: "...", refreshToken: "..." },
  llm: { provider: "openai", apiKey: process.env.OPENAI_KEY },
})

const payment = await agent.createPayment({ amount: 499, note: "Order #1" })
const result  = await agent.verifyPayment({ expectedAmount: 499 })

result.verified          // true
result.confidence        // 0.95`;

const routeCode = `// app/api/pay/route.ts
import { UpiAgent } from "upiagent"

const agent = new UpiAgent({ /* config */ })

export async function POST(req: Request) {
  const { amount, orderId } = await req.json()
  const payment = await agent.createPayment({ amount, note: orderId })
  return Response.json(payment)
}`;

export default function Home() {
  return (
    <main className="flex flex-col">
      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-6">
            <span className="font-mono text-sm font-medium text-foreground tracking-tight">upiagent</span>
            <div className="hidden sm:flex items-center gap-5">
              <a href="#how" className="text-xs text-muted hover:text-foreground transition-colors">How it works</a>
              <a href="#demo" className="text-xs text-muted hover:text-foreground transition-colors">Demo</a>
              <a href="#quickstart" className="text-xs text-muted hover:text-foreground transition-colors">Docs</a>
              <a href="#pricing" className="text-xs text-muted hover:text-foreground transition-colors">Pricing</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/AmarPathak/upiagent"
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href={`${DASHBOARD_URL}/signup`}
              className="text-xs font-medium px-3.5 py-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              Get started
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-14 overflow-hidden">
        <HeroCanvas />

        {/* Radial vignette */}
        <div
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{
            background: "radial-gradient(ellipse 60% 55% at 50% 45%, transparent 0%, var(--background) 75%)",
          }}
        />

        {/* Top fade */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-background to-transparent pointer-events-none z-[1]" />

        <div className="relative z-10 max-w-2xl w-full text-center">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-border bg-surface-raised/50 text-[11px] font-mono text-muted mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
            Open source &middot; MIT licensed
          </div>

          <h1 className="text-[clamp(2.5rem,6vw,4rem)] font-bold tracking-[-0.03em] leading-[1.05] mb-6">
            Accept UPI payments
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-accent to-cyan">
              without a gateway
            </span>
          </h1>

          <p className="text-[17px] text-muted leading-relaxed max-w-lg mx-auto mb-10">
            Generate QR codes. Customers pay with any UPI app.
            Connect your alert sources. AI verifies every transaction.
            No Razorpay. No fees. No merchant onboarding.
          </p>

          <div className="flex items-center justify-center gap-3 mb-16">
            <a
              href={`${DASHBOARD_URL}/signup`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
            >
              Start building
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
            <a
              href="https://github.com/AmarPathak/upiagent"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm text-muted hover:text-foreground hover:border-foreground/20 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Star on GitHub
            </a>
          </div>

          <Terminal />
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none z-[1]" />
      </section>

      {/* ── Numbers ─────────────────────────────────────── */}
      <section className="px-6 py-20 border-t border-border">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "0%", label: "Transaction fees" },
            { value: "~$0.001", label: "Per verification" },
            { value: "< 10s", label: "Verification time" },
            { value: "Any", label: "UPI app supported" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-1">
                {stat.value}
              </div>
              <div className="text-xs text-muted font-mono">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section id="how" className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            Generate. Pay. Connect. Verify.
          </h2>
          <p className="text-muted text-[15px] mb-6 max-w-lg">
            UPI is an open protocol — anyone can generate a payment QR.
            The hard part is verification. upiagent plugs into your alert sources
            and uses AI to confirm every transaction.
          </p>

          <AnimatedFlow />

          <div className="grid gap-4 mt-6">
            <Step
              num="01"
              title="Generate a payment QR"
              desc="upiagent builds a standard upi://pay intent URL with your UPI ID, amount, and transaction reference. Renders it as a QR code. Works with GPay, PhonePe, Paytm, CRED — every UPI app."
            />
            <Step
              num="02"
              title="Customer scans and pays"
              desc="Payment happens entirely in the customer's UPI app. Money goes straight to your bank account. No intermediary. No credentials exchanged."
            />
            <Step
              num="03"
              title="Connect your alert sources"
              desc="Plug in where your bank notifications live. Gmail bank alerts today — SMS, WhatsApp, and screenshot parsing coming soon. One OAuth click to connect, no manual credentials."
            />
            <Step
              num="04"
              title="AI verifies the payment"
              desc="An LLM parses the alert, extracts amount, UPI reference, sender, and timestamp. Then a 4-layer security pipeline validates format, matches amount to the paisa, checks time window, and detects duplicates. All four must pass."
            />
          </div>
        </div>
      </section>

      {/* ── Live Demo ────────────────────────────────────── */}
      <section id="demo" className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <SectionLabel>Try it</SectionLabel>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            Live demo
          </h2>
          <p className="text-muted text-[15px] mb-10">
            Real QR code. Real verification. Not a simulation.
          </p>
          <LiveDemo />
        </div>
      </section>

      {/* ── Quick Start ─────────────────────────────────── */}
      <section id="quickstart" className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <SectionLabel>Quick start</SectionLabel>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-8">
            Five minutes to first payment.
          </h2>

          <div className="space-y-4">
            <CodeBlock code={installCode} lang="bash" filename="terminal" />
            <CodeBlock code={quickStart} lang="typescript" filename="app.ts" />
          </div>
        </div>
      </section>

      {/* ── Security ─────────────────────────────────────── */}
      <section className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <SectionLabel>Security</SectionLabel>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            Four validation layers.
          </h2>
          <p className="text-muted text-[15px] mb-10 max-w-lg">
            Every LLM-parsed payment runs through a defense-in-depth pipeline.
            Each layer catches a different class of failure.
          </p>

          <div className="grid gap-3">
            {[
              { num: "01", name: "Format Validation", desc: "Zod schema catches LLM hallucinations before they enter your system." },
              { num: "02", name: "Amount Matching", desc: "Exact match to the paisa. No fuzzy matching on financial data." },
              { num: "03", name: "Time Window", desc: "Configurable window blocks replay attacks from stale emails." },
              { num: "04", name: "Duplicate Detection", desc: "UPI reference ID tracking prevents double-crediting." },
            ].map((layer) => (
              <SecurityLayer key={layer.num} {...layer} />
            ))}
          </div>
        </div>
      </section>

      {/* ── LLM vs Regex ─────────────────────────────────── */}
      <section className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <SectionLabel>Why LLM</SectionLabel>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-8">
            Banks change templates. Your code doesn&apos;t break.
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-6 rounded-xl border border-border bg-surface">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-red-500/50" />
                <span className="font-mono text-[11px] text-muted/60 uppercase tracking-wider">Regex</span>
              </div>
              <p className="text-[14px] text-muted leading-relaxed">
                One pattern per bank, per format. HDFC changes their template — silent failure.
                SBI sends Hindi — no match. Constant maintenance.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-accent/15 bg-accent/[0.02]">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-cyan" />
                <span className="font-mono text-[11px] text-foreground/50 uppercase tracking-wider">upiagent</span>
              </div>
              <p className="text-[14px] text-muted leading-relaxed">
                LLM reads the email like a human. Any bank, any language, any format.
                Template changes? Zero code changes. Zod validates the output.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Framework ─────────────────────────────────────── */}
      <section className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <SectionLabel>Framework ready</SectionLabel>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-8">
            Drops into any Node.js backend.
          </h2>
          <CodeBlock code={routeCode} lang="typescript" filename="app/api/pay/route.ts" />
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────── */}
      <section id="pricing" className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <SectionLabel>Pricing</SectionLabel>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            Pay for LLM tokens, not transactions.
          </h2>
          <p className="text-muted text-[15px] mb-10">
            Razorpay charges 2% per transaction. On &#8377;499, that&apos;s &#8377;9.98. upiagent costs &#8377;0.008.
          </p>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-raised/50">
                  <th className="px-5 py-3.5 text-left font-mono text-[11px] text-muted/60 font-normal uppercase tracking-wider">Model</th>
                  <th className="px-5 py-3.5 text-left font-mono text-[11px] text-muted/60 font-normal uppercase tracking-wider">Per verification</th>
                  <th className="px-5 py-3.5 text-left font-mono text-[11px] text-muted/60 font-normal uppercase tracking-wider">1K verifications</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[13px]">
                <tr className="border-b border-border">
                  <td className="px-5 py-3.5 text-foreground/70">gpt-4o-mini</td>
                  <td className="px-5 py-3.5 text-cyan">~$0.0001</td>
                  <td className="px-5 py-3.5 text-muted/60">~$0.10</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-5 py-3.5 text-foreground/70">gpt-4o</td>
                  <td className="px-5 py-3.5 text-foreground/50">~$0.005</td>
                  <td className="px-5 py-3.5 text-muted/60">~$5.00</td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 text-foreground/70">claude-sonnet</td>
                  <td className="px-5 py-3.5 text-foreground/50">~$0.007</td>
                  <td className="px-5 py-3.5 text-muted/60">~$7.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Story ─────────────────────────────────────────── */}
      <section className="px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <p className="font-mono text-xs text-muted uppercase tracking-widest mb-2">
            The story
          </p>
          <p className="text-2xl font-semibold tracking-tight mb-6">
            Built in a day. By one person. For real.
          </p>
          <div className="space-y-4 text-sm text-muted leading-relaxed max-w-2xl">
            <p>
              Hi, I&apos;m <span className="text-foreground font-medium">Amar</span> — an indie hacker from India.
              I built upiagent because every time I shipped a side project that needed payments,
              Razorpay wanted merchant onboarding, KYC docs, and a 2% cut. For a ₹49 product,
              that&apos;s ₹1 gone per sale. For a hobby project, that&apos;s friction I didn&apos;t need.
            </p>
            <p>
              UPI is free. Everyone in India has it. The only missing piece was
              <span className="text-foreground"> &quot;did they actually pay?&quot;</span> — so I built
              an LLM that reads your bank&apos;s email alerts and answers that question automatically.
            </p>
            <p>
              This entire thing — the npm package, the SaaS dashboard, the landing page —
              was built in <span className="text-foreground font-medium">one day</span>.
              It&apos;s not perfect. The{" "}
              <a href="https://github.com/AmarPathak/upiagent/blob/main/docs/limitations-and-roadmap.md" className="text-foreground underline">
                limitations are documented
              </a>.
              But the dashboard shows you exactly how well it&apos;s working — verification rates,
              confidence scores, every evidence trail. You can see for yourself.
            </p>
            <p>
              If you&apos;re an indie hacker, a hobby dev, or a small shop owner who just wants
              to accept UPI without the enterprise BS — this is for you.
            </p>
          </div>

          <div className="mt-8 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-surface-raised border border-border flex items-center justify-center text-sm font-mono">
              A
            </div>
            <div>
              <p className="text-sm font-medium">Amar Pathak</p>
              <p className="text-xs text-muted">
                <a href="https://github.com/AmarPathak" className="hover:text-foreground transition-colors">@AmarPathak</a>
                {" · "}
                <a href="https://twitter.com/AmarPathak" className="hover:text-foreground transition-colors">Twitter</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="relative px-6 py-32 border-t border-border overflow-hidden">
        {/* Gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 50% 70% at 50% 100%, var(--glow), transparent)",
          }}
        />

        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
            Start accepting payments today.
          </h2>
          <p className="text-muted text-[15px] mb-8">
            Open source. Self-host or use the managed API. No vendor lock-in.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a
              href={`${DASHBOARD_URL}/signup`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
            >
              Get started free
            </a>
            <a
              href="https://github.com/AmarPathak/upiagent"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border text-sm text-muted hover:text-foreground hover:border-foreground/20 transition-all"
            >
              Documentation
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="relative overflow-hidden bg-[#f5f5f7] text-[#1d1d1f]">
        {/* Giant wordmark */}
        <div className="relative px-6 pt-24 pb-8">
          <div className="max-w-5xl mx-auto">
            <span className="block font-mono font-bold text-[clamp(4rem,15vw,11rem)] leading-[0.85] tracking-[-0.06em] text-[#1d1d1f]/[0.06] select-none">
              upi
              <br />
              agent
            </span>
          </div>
        </div>

        {/* Links row */}
        <div className="relative px-6 pb-16">
          <div className="max-w-5xl mx-auto flex flex-wrap gap-x-14 gap-y-8">
            <div className="flex flex-col gap-2.5">
              <span className="font-mono text-[10px] text-[#1d1d1f]/30 uppercase tracking-[0.2em]">Product</span>
              <a href="#how" className="text-[13px] text-[#1d1d1f]/50 hover:text-[#1d1d1f] transition-colors">How it works</a>
              <a href="#demo" className="text-[13px] text-[#1d1d1f]/50 hover:text-[#1d1d1f] transition-colors">Live demo</a>
              <a href="#quickstart" className="text-[13px] text-[#1d1d1f]/50 hover:text-[#1d1d1f] transition-colors">Docs</a>
              <a href="#pricing" className="text-[13px] text-[#1d1d1f]/50 hover:text-[#1d1d1f] transition-colors">Pricing</a>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="font-mono text-[10px] text-[#1d1d1f]/30 uppercase tracking-[0.2em]">Source</span>
              <a href="https://github.com/AmarPathak/upiagent" className="text-[13px] text-[#1d1d1f]/50 hover:text-[#1d1d1f] transition-colors">GitHub</a>
              <a href="https://www.npmjs.com/package/upiagent" className="text-[13px] text-[#1d1d1f]/50 hover:text-[#1d1d1f] transition-colors">npm</a>
              <a href="https://github.com/AmarPathak/upiagent/issues" className="text-[13px] text-[#1d1d1f]/50 hover:text-[#1d1d1f] transition-colors">Issues</a>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="font-mono text-[10px] text-[#1d1d1f]/30 uppercase tracking-[0.2em]">Connect</span>
              <a href="https://github.com/AmarPathak" className="text-[13px] text-[#1d1d1f]/50 hover:text-[#1d1d1f] transition-colors">GitHub</a>
              <a href="https://x.com/AmarPathak" className="text-[13px] text-[#1d1d1f]/50 hover:text-[#1d1d1f] transition-colors">X / Twitter</a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="relative px-6 py-5 border-t border-[#1d1d1f]/10">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <span className="font-mono text-[11px] text-[#1d1d1f]/30">
              MIT &middot; {new Date().getFullYear()}
            </span>
            <div className="flex items-center gap-5">
              <a href="https://github.com/AmarPathak/upiagent" className="text-[#1d1d1f]/30 hover:text-[#1d1d1f] transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </a>
              <a href="https://x.com/AmarPathak" className="text-[#1d1d1f]/30 hover:text-[#1d1d1f] transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] text-accent/70 uppercase tracking-[0.15em] mb-3">
      {children}
    </p>
  );
}

function Step({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-9 h-9 rounded-lg border border-border bg-surface-raised flex items-center justify-center font-mono text-[11px] text-muted/60 shrink-0">
        {num}
      </div>
      <div>
        <div className="font-medium text-[15px] mb-0.5 text-foreground/90">{title}</div>
        <p className="text-[14px] text-muted leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

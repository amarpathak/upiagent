"use client";

import { useRef } from "react";
import { motion, useInView } from "@/components/motion-client";
import { CodeBlock } from "./code-block";
import { SecurityLayer } from "./security-layer";

const installCode = `npm install upiagent`;

const quickStartCode = `import { UpiAgent } from "upiagent"

const agent = new UpiAgent({
  merchant: { upiId: "you@ybl", name: "Your Store" },
  gmail: { clientId: "...", clientSecret: "...", refreshToken: "..." },
  llm: { provider: "openai", apiKey: process.env.OPENAI_KEY },
})

const payment = await agent.createPayment({ amount: 499, note: "Order #1" })
const result  = await agent.verifyPayment({ expectedAmount: 499 })

result.verified          // true
result.confidence        // 0.95`;

const securityLayers = [
  {
    num: "01",
    name: "Format Validation",
    desc: "Zod schema catches LLM hallucinations before they enter your system.",
  },
  {
    num: "02",
    name: "Amount Matching",
    desc: "Exact match to the paisa. No fuzzy matching on financial data.",
  },
  {
    num: "03",
    name: "Time Window",
    desc: "Configurable window blocks replay attacks from stale emails.",
  },
  {
    num: "04",
    name: "Duplicate Detection",
    desc: "UPI reference ID tracking prevents double-crediting.",
  },
];

export function QuickStartSecurity() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="quickstart" ref={ref} className="border-t border-border pt-16 px-6 pb-20">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
        {/* LEFT: For developers */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <span className="font-mono text-[10px] text-muted uppercase tracking-[0.2em] mb-4 block">
            For developers
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-medium tracking-tight mb-8">
            <em className="not-italic bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
              Five minutes to first payment.
            </em>
          </h2>
          <div className="space-y-4">
            <CodeBlock code={installCode} lang="bash" filename="terminal" />
            <CodeBlock code={quickStartCode} lang="typescript" filename="index.ts" />
          </div>
        </motion.div>

        {/* RIGHT: 4-layer verification */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <span className="font-mono text-[10px] text-muted uppercase tracking-[0.2em] mb-4 block">
            4-layer verification
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-medium tracking-tight mb-8 text-foreground">
            Every payment verified four ways.
          </h2>
          <div className="space-y-3">
            {securityLayers.map((layer, i) => (
              <motion.div
                key={layer.num}
                initial={{ opacity: 0, y: 10 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                transition={{
                  duration: 0.5,
                  ease: "easeOut",
                  delay: 0.2 + i * 0.1,
                }}
              >
                <SecurityLayer num={layer.num} name={layer.name} desc={layer.desc} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

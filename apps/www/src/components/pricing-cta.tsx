"use client";

import { useRef } from "react";
import { motion, useInView } from "@/components/motion-client";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001";

const models = [
  {
    name: "Gemini Flash (free tier)",
    perVerification: "~$0.0001",
    per1000: "~$0.10",
    highlight: true,
  },
  {
    name: "GPT-4o-mini",
    perVerification: "~$0.001",
    per1000: "~$1.00",
    highlight: false,
  },
  {
    name: "Claude Sonnet",
    perVerification: "~$0.003",
    per1000: "~$3.00",
    highlight: false,
  },
];

export function PricingCta() {
  const pricingRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const pricingInView = useInView(pricingRef, { once: true, margin: "-80px" });
  const ctaInView = useInView(ctaRef, { once: true, margin: "-80px" });

  return (
    <>
      {/* ── Pricing ──────────────────────────────────────── */}
      <section id="pricing" ref={pricingRef} className="border-t border-border pt-16 px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={pricingInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mb-10"
          >
            <span className="font-mono text-[10px] text-muted uppercase tracking-[0.2em] mb-4 block">
              Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-medium text-foreground tracking-tight mb-3">
              Pay for AI tokens, not transactions.
            </h2>
            <p className="text-sm text-muted max-w-2xl">
              Razorpay charges 2% per transaction. On &#8377;499, that&apos;s &#8377;9.98. upiagent costs &#8377;0.008.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={pricingInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
          >
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-raised/50">
                    <th className="text-left px-5 py-3 font-mono text-[11px] text-muted uppercase tracking-wider font-medium">
                      Model
                    </th>
                    <th className="text-right px-5 py-3 font-mono text-[11px] text-muted uppercase tracking-wider font-medium">
                      Per verification
                    </th>
                    <th className="text-right px-5 py-3 font-mono text-[11px] text-muted uppercase tracking-wider font-medium">
                      Per 1,000
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((model) => (
                    <tr
                      key={model.name}
                      className={`border-b border-border last:border-b-0 transition-colors ${
                        model.highlight
                          ? "bg-accent-green/[0.04] hover:bg-accent-green/[0.07]"
                          : "hover:bg-surface-raised/40"
                      }`}
                    >
                      <td className="px-5 py-4">
                        <span
                          className={`text-[13px] font-medium ${
                            model.highlight ? "text-accent-green" : "text-foreground/80"
                          }`}
                        >
                          {model.name}
                        </span>
                        {model.highlight && (
                          <span className="ml-2 text-[10px] font-mono text-accent-green/70 border border-accent-green/20 px-1.5 py-0.5 rounded">
                            default
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-[13px] text-muted">
                        {model.perVerification}
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-[13px] text-muted">
                        {model.per1000}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[12px] text-muted/60 font-mono">
              Default is Gemini (free tier). Bring your own key for any model.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────── */}
      <div ref={ctaRef} className="relative overflow-hidden px-6 py-24">
        {/* Animated radial gradients */}
        <motion.div
          initial={{ opacity: 0.3 }}
          animate={ctaInView ? { opacity: 1 } : { opacity: 0.3 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              "radial-gradient(ellipse 80% 50% at 20% 50%, color-mix(in srgb, var(--accent-blue) 8%, transparent) 0%, transparent 70%)",
              "radial-gradient(ellipse 60% 40% at 80% 50%, color-mix(in srgb, var(--accent-purple) 8%, transparent) 0%, transparent 70%)",
            ].join(", "),
          }}
        />

        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <h2 className="text-4xl sm:text-5xl font-serif font-medium text-foreground tracking-tight mb-4">
              Start accepting payments today.
            </h2>
            <p className="text-base text-muted mb-10">
              No sign-up. No approval. No fees. Just npm install.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href={`${DASHBOARD_URL}/signup`}
              className="px-7 py-3 rounded-xl bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
            >
              Get started free
            </a>
            <a
              href="https://github.com/AmarPathak/upiagent"
              className="px-7 py-3 rounded-xl border border-border text-sm font-medium text-foreground hover:border-border-hover hover:bg-surface-raised transition-colors"
            >
              Star on GitHub
            </a>
          </motion.div>
        </div>
      </div>
    </>
  );
}

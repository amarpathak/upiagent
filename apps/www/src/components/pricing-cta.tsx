"use client";

import { useRef } from "react";
import { motion, useInView } from "@/components/motion-client";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001";

const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    description: "For indie hackers testing the waters.",
    features: [
      "100 payments/month",

      "1 UPI ID",
      "Gmail verification source",
      "Community support (GitHub)",
      "Dashboard with basic analytics",
    ],
    cta: "Start free",
    ctaHref: `${DASHBOARD_URL}/signup`,
    highlight: false,
  },
  {
    name: "Pro",
    price: "₹499",
    period: "/month",
    description: "For serious builders shipping real products.",
    features: [
      "Unlimited payments",

      "Unlimited UPI IDs",
      "More alert sources (coming soon)",
      "Webhooks + priority support",
    ],
    cta: "Start building",
    ctaHref: `${DASHBOARD_URL}/signup?plan=pro`,
    highlight: true,
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
      <section id="pricing" ref={pricingRef} className="border-t border-border pt-16 px-8 pb-20">
        <div className="max-w-[1100px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={pricingInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center mb-12"
          >
            <p className="text-[11px] text-muted-light tracking-[2px] uppercase mb-3">Pricing</p>
            <h2 className="font-serif text-[36px] font-normal tracking-tight mb-3">
              Simple plans.{" "}
              <em className="italic bg-gradient-to-r from-accent-green to-accent-blue bg-clip-text text-transparent">
                No surprises.
              </em>
            </h2>
            <p className="text-muted text-[15px] max-w-[520px] mx-auto">
              Razorpay charges 2% per transaction. On &#8377;1 lakh in sales, that&apos;s &#8377;2,000 gone.
              With upiagent, you keep everything.
            </p>
          </motion.div>

          {/* Plan cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-[720px] mx-auto">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={pricingInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
                className={`relative rounded-2xl border p-8 flex flex-col ${
                  plan.highlight
                    ? "border-accent-green/30 bg-accent-green/[0.02] shadow-sm"
                    : "border-border bg-surface"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-8 px-3 py-1 bg-accent-green text-white text-[11px] font-medium rounded-full">
                    Most popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-[18px] font-semibold mb-1">{plan.name}</h3>
                  <p className="text-[13px] text-muted mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="font-serif text-[40px] tracking-tight">{plan.price}</span>
                    <span className="text-[13px] text-muted">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-[13px] text-muted">
                      <svg className="w-4 h-4 text-accent-green shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 8.5l3 3 7-7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                <a
                  href={plan.ctaHref}
                  className={`block text-center py-3 rounded-xl text-[14px] font-medium transition-all ${
                    plan.highlight
                      ? "bg-foreground text-background hover:bg-foreground/90 hover:-translate-y-0.5 hover:shadow-lg"
                      : "border border-border text-foreground hover:border-border-hover hover:bg-surface-raised"
                  }`}
                >
                  {plan.cta}
                </a>
              </motion.div>
            ))}
          </div>

          {/* Supported LLMs note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={pricingInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 p-6 rounded-xl border border-border bg-surface-raised"
          >
            <p className="text-[13px] text-muted mb-2 font-medium">Supported LLMs</p>
            <p className="text-[12px] text-muted-light">
              Works with OpenAI, Anthropic, Google Gemini, and any LangChain-compatible provider. Bring your own API key — verification costs are between $0.0001 and $0.007 per transaction depending on the model.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────── */}
      <div ref={ctaRef} className="relative overflow-hidden px-8 py-24">
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

        <div className="relative max-w-[600px] mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <h2 className="font-serif text-[36px] font-normal tracking-tight mb-4">
              Start accepting payments today.
            </h2>
            <p className="text-muted text-[15px] mb-8">
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
              className="px-7 py-3 rounded-xl bg-foreground text-background text-[14px] font-medium hover:bg-foreground/90 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              Get started free
            </a>
            <a
              href="https://github.com/AmarPathak/upiagent"
              className="px-7 py-3 rounded-xl border border-border text-[14px] font-medium text-foreground hover:border-border-hover hover:bg-surface-raised transition-colors"
            >
              Star on GitHub
            </a>
          </motion.div>
        </div>
      </div>
    </>
  );
}

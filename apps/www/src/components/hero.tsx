"use client";

import { motion } from "@/components/motion-client";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001";

export function Hero() {
  return (
    <section className="pt-28 pb-10 px-8">
      <div className="max-w-3xl mx-auto text-center">
        {/* Pill badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full text-[12px] text-muted border border-border bg-gradient-to-r from-accent-green/5 to-accent-blue/5"
        >
          <span className="w-[18px] h-[18px] rounded-full bg-gradient-to-br from-accent-green to-accent-blue flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 6h8M6 2l4 4-4 4" />
            </svg>
          </span>
          Open source · Built in India · Zero fees
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="font-serif text-[clamp(2rem,7vw,54px)] font-normal leading-[1.1] tracking-[-1.5px] mb-5"
        >
          UPI is free.{" "}
          <span className="relative inline-block">
            <span className="text-muted-light">Payment gateways</span>
            <span
              className="absolute left-[-4px] right-[-4px] top-[52%] h-[3px] rounded-sm bg-gradient-to-r from-red-400 to-strike-red origin-left"
              style={{ animation: "strike-in 0.7s cubic-bezier(0.25,0.46,0.45,0.94) 0.6s both" }}
            />
          </span>
          <br />
          <span
            className="italic bg-gradient-to-r from-accent-green via-accent-blue to-accent-purple bg-clip-text text-transparent bg-[length:200%_200%]"
            style={{ animation: "gradient-shift 4s ease-in-out infinite" }}
          >
            shouldn&apos;t cost 2%.
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-[16px] text-muted leading-[1.7] max-w-[480px] mx-auto mb-8"
        >
          Open-source UPI payment verification. Generate a QR, customer pays with <strong className="text-foreground/70 font-medium">any UPI app</strong>,
          AI confirms the transaction. Money goes straight to <strong className="text-foreground/70 font-medium">your bank</strong>. No gateway. No middleman.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex items-center justify-center gap-3 mb-4"
        >
          <a
            href={`${DASHBOARD_URL}/signup`}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-foreground text-background text-[14px] font-medium hover:bg-foreground/90 transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            Start building
            <svg className="w-4 h-4" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.75 9h10.5M10.5 5.25L14.25 9l-3.75 3.75" />
            </svg>
          </a>
          <a
            href="#demo"
            className="px-7 py-3 rounded-xl border-[1.5px] border-border text-[14px] text-muted hover:border-border-hover hover:text-foreground transition-all"
          >
            See the live demo
          </a>
        </motion.div>

        {/* npm hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          className="font-mono text-[12px] text-muted-light"
        >
          or run{" "}
          <code className="bg-accent-green/5 border border-accent-green/10 px-2.5 py-0.5 rounded-md text-muted">
            npm i upiagent
          </code>
        </motion.p>
      </div>
    </section>
  );
}

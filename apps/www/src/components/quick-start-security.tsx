"use client";

import { useRef } from "react";
import { motion, useInView } from "@/components/motion-client";

const painPoints = [
  {
    gateway: "Business registration & KYC docs",
    upiagent: "npm install and go",
  },
  {
    gateway: "2-3% fee on every transaction",
    upiagent: "Zero transaction fees",
  },
  {
    gateway: "Days to weeks for approval",
    upiagent: "Start accepting payments in 5 minutes",
  },
  {
    gateway: "Money settles in 2-3 business days",
    upiagent: "Money lands in your bank instantly",
  },
  {
    gateway: "Vendor lock-in, proprietary SDKs",
    upiagent: "Open source, MIT licensed",
  },
];

export function QuickStartSecurity() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="quickstart" className="px-8 py-10" ref={ref}>
      <div className="max-w-[800px] mx-auto">
        <div className="border-t border-border pt-10" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <p className="text-[11px] text-muted-light tracking-[2px] uppercase mb-3">Why upiagent</p>
          <h2 className="font-serif text-[36px] font-normal tracking-tight">
            No paperwork.{" "}
            <em className="italic bg-gradient-to-r from-accent-green to-accent-blue bg-clip-text text-transparent">
              No permission needed.
            </em>
          </h2>
        </motion.div>

        <div className="space-y-3">
          {painPoints.map((point, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="grid grid-cols-2 gap-4 items-center"
            >
              <div className="flex items-center gap-3 py-4 px-5 rounded-xl bg-strike-red/[0.03] border border-strike-red/10">
                <svg className="w-4 h-4 text-strike-red/50 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
                <span className="text-[13px] text-muted">{point.gateway}</span>
              </div>

              <div className="flex items-center gap-3 py-4 px-5 rounded-xl bg-accent-green/[0.03] border border-accent-green/10">
                <svg className="w-4 h-4 text-accent-green shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8.5l3 3 7-7" />
                </svg>
                <span className="text-[13px] text-foreground/80 font-medium">{point.upiagent}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-10 text-center"
        >
          <p className="font-mono text-[13px] text-muted mb-2">Get started in one line:</p>
          <code className="inline-block px-6 py-3 rounded-xl bg-foreground text-background font-mono text-[14px]">
            npm install upiagent
          </code>
        </motion.div>
      </div>
    </section>
  );
}

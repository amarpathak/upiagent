"use client";

import { useRef } from "react";
import { motion, useInView } from "@/components/motion-client";

const STEPS = [
  {
    number: "01",
    title: "Generate QR",
    description:
      "Create a UPI intent QR with amount and your VPA. Works with any bank.",
  },
  {
    number: "02",
    title: "Customer pays",
    description:
      "Scan with GPay, PhonePe, Paytm. Money goes directly to your bank.",
  },
  {
    number: "03",
    title: "Connect Gmail",
    description:
      "Bank sends confirmation email. upiagent reads it automatically via OAuth.",
  },
  {
    number: "04",
    title: "AI verifies",
    description:
      "LLM parses the email. Matches amount, time, dedup. Payment confirmed.",
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="how" className="py-12 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Section label */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="text-center font-mono text-[11px] tracking-[0.15em] text-muted uppercase mb-3"
        >
          How it works
        </motion.p>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="text-center font-serif text-[clamp(1.6rem,4vw,36px)] font-normal tracking-[-0.5px] mb-14"
        >
          Four steps.{" "}
          <em
            className="not-italic italic bg-gradient-to-r from-accent-green via-accent-blue to-accent-purple bg-clip-text text-transparent bg-[length:200%_200%]"
            style={{ animation: "gradient-shift 4s ease-in-out infinite" }}
          >
            No middleman.
          </em>
        </motion.h2>

        {/* Cards grid */}
        <div
          ref={ref}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {STEPS.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.5,
                delay: i * 0.1,
                type: "spring",
                stiffness: 130,
                damping: 20,
              }}
              className="
                group
                bg-surface border border-border rounded-2xl
                p-6 flex flex-col gap-3
                hover:-translate-y-1
                hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)]
                hover:border-border-hover
                transition-all duration-200
                cursor-default
              "
            >
              <span className="font-serif text-[32px] leading-none text-border font-normal select-none">
                {step.number}
              </span>
              <p className="font-medium text-[14px] text-foreground leading-snug">
                {step.title}
              </p>
              <p className="text-[13px] text-muted leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useRef } from "react";
import { motion, useInView } from "@/components/motion-client";

const steps = [
  {
    icon: "⬜",
    label: "QR Code",
    desc: "Generate a UPI intent QR tied to your VPA and amount.",
  },
  {
    icon: "📱",
    label: "Customer pays",
    desc: "Scan with any UPI app. Money goes straight to your bank.",
  },
  {
    icon: "📧",
    label: "Gmail alert",
    desc: "Bank sends a confirmation email. upiagent reads it via OAuth.",
  },
  {
    icon: "✓",
    label: "AI verified",
    desc: "LLM parses, matches amount & time, deduplicates. Done.",
  },
];

export function ProductFlow() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="relative py-10 px-6 overflow-hidden">
      {/* Mesh gradient background */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 20% 30%, rgba(5,150,105,0.07) 0%, transparent 60%)," +
            "radial-gradient(ellipse 60% 70% at 80% 70%, rgba(59,130,246,0.07) 0%, transparent 60%)," +
            "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(139,92,246,0.04) 0%, transparent 70%)",
        }}
      />

      {/* Subtle grid overlay */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Floating orbs */}
      <div
        aria-hidden
        className="absolute top-[15%] left-[10%] w-48 h-48 rounded-full -z-10"
        style={{
          background:
            "radial-gradient(circle, rgba(5,150,105,0.12) 0%, transparent 70%)",
          animation: "orb-float-1 8s ease-in-out infinite",
        }}
      />
      <div
        aria-hidden
        className="absolute top-[50%] right-[8%] w-64 h-64 rounded-full -z-10"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)",
          animation: "orb-float-2 11s ease-in-out infinite",
        }}
      />
      <div
        aria-hidden
        className="absolute bottom-[10%] left-[40%] w-40 h-40 rounded-full -z-10"
        style={{
          background:
            "radial-gradient(circle, rgba(139,92,246,0.09) 0%, transparent 70%)",
          animation: "orb-float-3 9s ease-in-out infinite",
        }}
      />

      <div className="max-w-5xl mx-auto">
        {/* Section label */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="text-center font-mono text-[11px] tracking-[0.15em] text-muted uppercase mb-3"
        >
          How it flows
        </motion.p>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="text-center font-serif text-[clamp(1.6rem,4vw,36px)] font-normal tracking-[-0.5px] mb-14"
        >
          From QR to confirmed — in seconds.
        </motion.h2>

        {/* Cards + connectors */}
        <div
          ref={ref}
          className="flex flex-col sm:flex-row items-stretch gap-0 sm:gap-0"
        >
          {steps.map((step, i) => (
            <div
              key={step.label}
              className="flex flex-col sm:flex-row items-center flex-1"
            >
              {/* Card */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  duration: 0.55,
                  delay: i * 0.3,
                  type: "spring",
                  stiffness: 120,
                  damping: 18,
                }}
                className="
                  flex-1 w-full
                  bg-white/85 backdrop-blur-md
                  border border-white/60
                  rounded-2xl
                  p-6
                  flex flex-col items-center text-center gap-3
                  shadow-[0_2px_16px_rgba(0,0,0,0.06)]
                  hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(0,0,0,0.10)]
                  transition-all duration-200
                "
              >
                <span className="text-3xl leading-none">{step.icon}</span>
                <p className="font-medium text-[14px] text-foreground leading-snug">
                  {step.label}
                </p>
                <p className="text-[12px] text-muted leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>

              {/* Connector — hidden on mobile, shown sm+ except after last card */}
              {i < steps.length - 1 && (
                <div className="hidden sm:flex items-center flex-shrink-0 w-8 mx-0">
                  <div className="relative w-full h-px bg-border overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent-green to-accent-blue"
                      initial={{ scaleX: 0 }}
                      animate={inView ? { scaleX: 1 } : {}}
                      transition={{
                        duration: 0.4,
                        delay: i * 0.3 + 0.5,
                        ease: "easeOut",
                      }}
                      style={{ transformOrigin: "left" }}
                    />
                  </div>
                  <svg
                    className="w-3 h-3 text-accent-blue flex-shrink-0 -ml-1"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 6h8M6 2l4 4-4 4" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

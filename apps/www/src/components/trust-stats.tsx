"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "@/components/motion-client";

const UPI_APPS = [
  "Google Pay",
  "PhonePe",
  "Paytm",
  "CRED",
  "BHIM",
  "Amazon Pay",
];

const STATS = [
  {
    value: 0,
    display: "0%",
    suffix: "",
    label: "Platform fees. Always.",
    gradient: true,
  },
  {
    value: 0.001,
    display: "~$0.001",
    suffix: "",
    label: "Per AI verification",
    gradient: false,
  },
  {
    value: 10,
    display: "<10s",
    suffix: "",
    label: "End-to-end confirmation",
    gradient: false,
  },
];

interface AnimatedNumberProps {
  targetDisplay: string;
  isGradient: boolean;
  inView: boolean;
  delay: number;
}

function AnimatedNumber({ targetDisplay, isGradient, inView, delay }: AnimatedNumberProps) {
  const [displayed, setDisplayed] = useState("0");
  const frameRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!inView || startedRef.current) return;

    // For non-numeric-countup displays, just reveal after delay
    // We do a simple char-reveal / number count for the numeric portion
    const delayMs = delay * 1000;

    const timeout = setTimeout(() => {
      startedRef.current = true;

      // Extract leading non-digit prefix and suffix
      const match = targetDisplay.match(/^([^0-9]*)(\d+(?:\.\d+)?)(.*)$/);
      if (!match) {
        setDisplayed(targetDisplay);
        return;
      }

      const prefix = match[1];
      const numStr = match[2];
      const suffix = match[3];
      const target = parseFloat(numStr);
      const isFloat = numStr.includes(".");
      const duration = 1400;
      const start = performance.now();

      function tick(now: number) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = target * eased;
        const formatted = isFloat
          ? current.toFixed(3)
          : Math.round(current).toString();
        setDisplayed(`${prefix}${formatted}${suffix}`);

        if (progress < 1) {
          frameRef.current = requestAnimationFrame(tick);
        } else {
          setDisplayed(targetDisplay);
        }
      }

      frameRef.current = requestAnimationFrame(tick);
    }, delayMs);

    return () => {
      clearTimeout(timeout);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [inView, targetDisplay, delay]);

  if (isGradient) {
    return (
      <span
        className="font-serif text-[36px] leading-none tracking-[-1px] bg-gradient-to-r from-accent-green to-accent-blue bg-clip-text text-transparent"
      >
        {displayed}
      </span>
    );
  }

  return (
    <span className="font-serif text-[36px] leading-none tracking-[-1px] text-foreground">
      {displayed}
    </span>
  );
}

export function TrustStats() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div ref={ref} className="border-t border-border">
      {/* Trust bar */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.4 }}
          className="text-center font-mono text-[10px] tracking-[0.18em] text-muted uppercase mb-6"
        >
          Works with every UPI app
        </motion.p>

        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {UPI_APPS.map((app, i) => (
            <motion.span
              key={app}
              initial={{ opacity: 0, y: 6 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.07 }}
              className="text-[13px] font-medium text-muted hover:text-foreground transition-colors duration-150 cursor-default"
            >
              {app}
            </motion.span>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: 0.3 + i * 0.12 }}
              className="flex flex-col items-center text-center gap-2 py-4 sm:py-0 sm:px-8"
            >
              <AnimatedNumber
                targetDisplay={stat.display}
                isGradient={stat.gradient}
                inView={inView}
                delay={0.3 + i * 0.12}
              />
              <p className="text-[13px] text-muted leading-snug">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

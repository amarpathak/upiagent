"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "@/components/motion-client";

const UPI_APPS = [
  {
    name: "Google Pay",
    logo: (
      <svg viewBox="0 0 435 174" className="h-6 w-auto" fill="none">
        <path d="M186.2 87.3V152h-14.8V18.6h39.2c9.5 0 18.5 3.5 25.2 9.8 6.8 6.3 10.5 14.3 10.5 23.3 0 9.2-3.7 17.2-10.5 23.5-6.6 6.3-15.5 9.5-25.2 9.5h-24.4v2.6zm0-54.5v38h24.8c5.7 0 11-2.2 14.8-6.2 3.9-4 6.2-9.1 6.2-14.8 0-5.6-2.3-10.7-6.2-14.8-3.9-3.8-9.1-6.2-14.8-6.2h-24.8z" fill="#5F6368"/>
        <path d="M282.5 62.3c10.9 0 19.5 2.9 25.8 8.7 6.3 5.8 9.5 13.8 9.5 23.8v48.1h-14.2v-10.8h-.6c-6.1 8.8-14.2 13.2-24.4 13.2-8.7 0-16-2.6-21.8-7.8-5.8-5.2-8.7-11.7-8.7-19.4 0-8.2 3.1-14.7 9.3-19.5 6.2-4.8 14.5-7.3 24.8-7.3 8.8 0 16 1.6 21.6 4.8V93c0-5.7-2.2-10.5-6.8-14.2-4.6-3.8-9.9-5.7-16-5.7-9.3 0-16.6 3.9-22 11.8l-13.1-8.2c8-11.7 19.9-17.5 35.5-17.5v3.1zm-19.2 54.3c0 4.3 1.8 7.9 5.5 10.7 3.6 2.8 7.9 4.2 12.7 4.2 6.9 0 13-2.6 18.2-7.7 5.2-5.1 7.8-11 7.8-17.7-4.5-3.7-10.8-5.5-19-5.5-5.9 0-10.9 1.5-14.8 4.4-4 2.9-6 6.5-6 10.7l-.4.9z" fill="#5F6368"/>
        <path d="M370 65.4l-49.3 113.4h-15.2l18.3-39.8-32.4-73.6h16l23.3 56h.4l22.7-56H370z" fill="#5F6368"/>
        <path d="M117.4 74.8c0-4.7-.4-9.3-1.2-13.7H59.8v26h32.3c-1.4 7.5-5.6 13.8-11.9 18.1v15h19.3c11.3-10.4 17.8-25.7 17.8-45.4h.1z" fill="#4285F4"/>
        <path d="M59.8 130.5c16.1 0 29.6-5.3 39.5-14.5l-19.3-15c-5.3 3.6-12.2 5.7-20.1 5.7-15.5 0-28.6-10.4-33.3-24.5H6.7v15.4c9.8 19.5 30 32.9 53.1 32.9z" fill="#34A853"/>
        <path d="M26.5 82.2c-1.2-3.6-1.9-7.4-1.9-11.3s.7-7.8 1.9-11.3V44.2H6.7C2.4 52.7 0 62.1 0 71.9s2.4 17.2 6.7 25.7l19.8-15.4z" fill="#FBBC05"/>
        <path d="M59.8 26.1c8.7 0 16.6 3 22.7 8.9l17-17C89.3 8.4 75.9 2.3 59.8 2.3 36.7 2.3 16.5 15.7 6.7 35.2l19.8 15.4c4.7-14.1 17.8-24.5 33.3-24.5z" fill="#EA4335"/>
      </svg>
    ),
  },
  {
    name: "PhonePe",
    logo: (
      <svg viewBox="0 0 120 32" className="h-5 w-auto">
        <text x="0" y="24" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="22" fill="#5F259F">PhonePe</text>
      </svg>
    ),
  },
  {
    name: "Paytm",
    logo: (
      <svg viewBox="0 0 100 32" className="h-5 w-auto">
        <text x="0" y="24" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="22" fill="#00BAF2">Paytm</text>
      </svg>
    ),
  },
  {
    name: "CRED",
    logo: (
      <svg viewBox="0 0 80 32" className="h-5 w-auto">
        <text x="0" y="24" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="22" letterSpacing="2" fill="#1a1a1a">CRED</text>
      </svg>
    ),
  },
  {
    name: "BHIM",
    logo: (
      <svg viewBox="0 0 80 32" className="h-5 w-auto">
        <text x="0" y="24" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="22" fill="#00897B">BHIM</text>
      </svg>
    ),
  },
  {
    name: "Amazon Pay",
    logo: (
      <svg viewBox="0 0 160 32" className="h-5 w-auto">
        <text x="0" y="24" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="20" fill="#FF9900">amazon</text>
        <text x="88" y="24" fontFamily="system-ui, sans-serif" fontWeight="400" fontSize="20" fill="#1a1a1a">pay</text>
      </svg>
    ),
  },
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
      <div className="max-w-5xl mx-auto px-6 py-8">
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
            <motion.div
              key={app.name}
              initial={{ opacity: 0, y: 6 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.07 }}
              className="opacity-40 hover:opacity-70 transition-opacity duration-150 cursor-default"
              title={app.name}
            >
              {app.logo}
            </motion.div>
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

"use client";

import { useRef } from "react";
import { motion, useInView } from "@/components/motion-client";
import { LiveDemo } from "./live-demo";

export function LiveDemoSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="demo" ref={ref} className="border-t border-border pt-16 px-6 pb-20">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-10"
        >
          <span className="font-mono text-[10px] text-muted uppercase tracking-[0.2em] mb-4 block">
            Live demo
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-medium text-foreground tracking-tight mb-3">
            Live demo
          </h2>
          <p className="text-base text-muted max-w-xl">
            Real QR code. Real verification. Not a simulation.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
        >
          <LiveDemo />
        </motion.div>
      </div>
    </section>
  );
}

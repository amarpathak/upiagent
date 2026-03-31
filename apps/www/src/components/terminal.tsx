"use client";

import { useEffect, useState, useRef } from "react";

const lines: { text: string; type: "cmd" | "output" | "success" | "dim" | "comment" }[] = [
  { text: "const payment = await agent.createPayment({ amount: 499 })", type: "cmd" },
  { text: "  QR generated  txn_m4x7k2", type: "dim" },
  { text: "", type: "dim" },
  { text: "  waiting for customer...", type: "dim" },
  { text: "", type: "dim" },
  { text: "const result = await agent.verifyPayment({ amount: 499 })", type: "cmd" },
  { text: "  gmail     3 alerts fetched", type: "dim" },
  { text: "  llm       parsed: 499.00 ref:412345678901", type: "dim" },
  { text: "  security  format ok  amount ok  time ok  dedup ok", type: "dim" },
  { text: "", type: "dim" },
  { text: "  verified  confidence: 0.95", type: "success" },
];

export function Terminal() {
  const [visibleLines, setVisibleLines] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          setVisibleLines(1);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (visibleLines === 0 || visibleLines >= lines.length) return;
    const line = lines[visibleLines];
    const delay = line?.type === "cmd" ? 700 : line?.text === "" ? 250 : 350;
    const timer = setTimeout(() => setVisibleLines((v) => v + 1), delay);
    return () => clearTimeout(timer);
  }, [visibleLines]);

  return (
    <div ref={ref} className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-raised/50">
        <div className="flex gap-1.5">
          <div className="w-[10px] h-[10px] rounded-full bg-[#ff5f57]/80" />
          <div className="w-[10px] h-[10px] rounded-full bg-[#febc2e]/80" />
          <div className="w-[10px] h-[10px] rounded-full bg-[#28c840]/80" />
        </div>
        <span className="text-[11px] text-muted/60 font-mono ml-3">payment-flow.ts</span>
      </div>

      {/* Content */}
      <div className="p-5 font-mono text-[13px] leading-7 min-h-[280px]">
        {lines.slice(0, visibleLines).map((line, i) => (
          <div
            key={i}
            className="animate-line"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            {line.text === "" ? (
              <br />
            ) : (
              <span
                className={
                  line.type === "cmd"
                    ? "text-foreground/90"
                    : line.type === "success"
                      ? "text-cyan"
                      : "text-muted/60"
                }
              >
                {line.text}
              </span>
            )}
          </div>
        ))}

        {visibleLines > 0 && visibleLines < lines.length && (
          <span className="cursor-blink text-accent/70 text-sm">_</span>
        )}
      </div>
    </div>
  );
}

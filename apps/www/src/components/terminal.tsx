"use client";

import { useEffect, useState, useRef } from "react";

const lines: { text: string; type: "cmd" | "success" | "dim" }[] = [
  { text: "const payment = await agent.createPayment({ amount: 499 })", type: "cmd" },
  { text: "// QR generated  txn_m4x7k2", type: "dim" },
  { text: "", type: "dim" },
  { text: "const result = await agent.verifyPayment({ amount: 499 })", type: "cmd" },
  { text: "// sources: 3 alerts  llm: ₹499.00 ref:412345678901", type: "dim" },
  { text: "// security: format ✓ amount ✓ time ✓ dedup ✓", type: "dim" },
  { text: "", type: "dim" },
  { text: "result.verified  // true — confidence: 0.95", type: "success" },
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
    const delay = line?.type === "cmd" ? 600 : line?.text === "" ? 150 : 250;
    const timer = setTimeout(() => setVisibleLines((v) => v + 1), delay);
    return () => clearTimeout(timer);
  }, [visibleLines]);

  return (
    <div ref={ref} className="rounded-xl border border-border bg-surface overflow-hidden max-w-xl">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border bg-surface-raised/50">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#ff5f57]/80" />
          <div className="w-2 h-2 rounded-full bg-[#febc2e]/80" />
          <div className="w-2 h-2 rounded-full bg-[#28c840]/80" />
        </div>
        <span className="text-[10px] text-muted/50 font-mono ml-2">payment-flow.ts</span>
      </div>

      <div className="p-4 font-mono text-[12px] leading-5">
        {lines.slice(0, visibleLines).map((line, i) => (
          <div
            key={i}
            className="animate-line"
            style={{ animationDelay: `${i * 20}ms` }}
          >
            {line.text === "" ? (
              <div className="h-3" />
            ) : (
              <span
                className={
                  line.type === "cmd"
                    ? "text-foreground/80"
                    : line.type === "success"
                      ? "text-cyan"
                      : "text-muted/40"
                }
              >
                {line.text}
              </span>
            )}
          </div>
        ))}

        {visibleLines > 0 && visibleLines < lines.length && (
          <span className="cursor-blink text-accent/50 text-xs">_</span>
        )}
      </div>
    </div>
  );
}

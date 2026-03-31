"use client";

import { useEffect, useState } from "react";

const lines: { text: string; type: "cmd" | "output" | "success" | "dim" }[] = [
  { text: "$ const payment = await agent.createPayment({ amount: 499 })", type: "cmd" },
  { text: "  ↳ QR generated  TXN_m4x7k2_a1b2c3d4e5f6", type: "dim" },
  { text: "", type: "dim" },
  { text: "  ⏳ waiting for customer to scan & pay...", type: "dim" },
  { text: "", type: "dim" },
  { text: "$ const result = await agent.verifyPayment({ expectedAmount: 499 })", type: "cmd" },
  { text: "  ↳ gmail    fetched 3 bank alerts", type: "dim" },
  { text: "  ↳ llm      parsed: ₹499.00 from john@ybl  ref:412345678901", type: "dim" },
  { text: "  ↳ security [format ✓] [amount ✓] [time ✓] [dedup ✓]", type: "dim" },
  { text: "", type: "dim" },
  { text: "  ✓ payment verified  confidence: 0.95", type: "success" },
];

export function Terminal() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    if (visibleLines >= lines.length) return;

    const line = lines[visibleLines];
    // Commands get a longer delay (feels like typing), output is faster
    const delay = line?.type === "cmd" ? 600 : line?.text === "" ? 200 : 300;

    const timer = setTimeout(() => {
      setVisibleLines((v) => v + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [visibleLines]);

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface-raised">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-border" />
          <div className="w-2.5 h-2.5 rounded-full bg-border" />
          <div className="w-2.5 h-2.5 rounded-full bg-border" />
        </div>
        <span className="text-xs text-muted font-mono ml-2">payment-flow.ts</span>
      </div>

      {/* Terminal content */}
      <div className="p-4 font-mono text-[13px] leading-6 min-h-[280px]">
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
                    ? "text-foreground"
                    : line.type === "success"
                      ? "text-accent font-medium"
                      : "text-muted"
                }
              >
                {line.text}
              </span>
            )}
          </div>
        ))}

        {/* Blinking cursor */}
        {visibleLines < lines.length && (
          <span className="cursor-blink text-accent">▌</span>
        )}
      </div>
    </div>
  );
}

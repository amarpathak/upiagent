"use client";

import { useEffect, useState } from "react";

const lines: { text: string; type: "cmd" | "output" | "success" | "dim" | "comment" }[] = [
  { text: "// create payment — generates UPI QR intent", type: "comment" },
  { text: "$ const payment = await agent.createPayment({ amount: 499 })", type: "cmd" },
  { text: "  QR generated  TXN_m4x7k2", type: "dim" },
  { text: "", type: "dim" },
  { text: "  waiting for payment...", type: "dim" },
  { text: "", type: "dim" },
  { text: "// verify — reads Gmail, parses with LLM", type: "comment" },
  { text: "$ const result = await agent.verifyPayment({ expectedAmount: 499 })", type: "cmd" },
  { text: "  gmail    3 alerts fetched", type: "dim" },
  { text: "  llm      parsed: 499.00 from john@ybl ref:412345678901", type: "dim" },
  { text: "  security [format ok] [amount ok] [time ok] [dedup ok]", type: "dim" },
  { text: "", type: "dim" },
  { text: "  payment verified  confidence: 0.95", type: "success" },
];

export function Terminal() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    if (visibleLines >= lines.length) return;

    const line = lines[visibleLines];
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
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-xs text-muted font-mono ml-2">payment-flow.ts</span>
      </div>

      {/* Terminal content */}
      <div className="p-4 font-mono text-[13px] leading-6 min-h-[300px]">
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
                      ? "text-cyan font-medium"
                      : line.type === "comment"
                        ? "text-muted/40 italic"
                        : "text-muted"
                }
              >
                {line.text}
              </span>
            )}
          </div>
        ))}

        {visibleLines < lines.length && (
          <span className="cursor-blink text-accent">_</span>
        )}
      </div>
    </div>
  );
}

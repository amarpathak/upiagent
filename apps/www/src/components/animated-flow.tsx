"use client";

import { useEffect, useState } from "react";

const nodes = [
  { id: "qr", label: "QR Code", x: 0, icon: "grid" },
  { id: "scan", label: "UPI App", x: 1, icon: "phone" },
  { id: "source", label: "Alert Source", x: 2, icon: "layers" },
  { id: "llm", label: "LLM Parse", x: 3, icon: "cpu" },
  { id: "verify", label: "Verified", x: 4, icon: "check" },
];

function NodeIcon({ icon }: { icon: string }) {
  const cls = "w-5 h-5 stroke-current";
  switch (icon) {
    case "grid":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
        </svg>
      );
    case "phone":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round">
          <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12" y2="18" strokeWidth="2" />
        </svg>
      );
    case "layers":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </svg>
      );
    case "cpu":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
          <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
          <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="15" x2="23" y2="15" />
          <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="15" x2="4" y2="15" />
        </svg>
      );
    case "check":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-5" />
        </svg>
      );
    default:
      return null;
  }
}

export function AnimatedFlow() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % nodes.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full py-12">
      <div className="flex items-center justify-between max-w-2xl mx-auto relative">
        {/* Connection line */}
        <div className="absolute top-1/2 left-[10%] right-[10%] h-px bg-border -translate-y-1/2" />
        <div
          className="absolute top-1/2 left-[10%] h-px bg-accent/60 -translate-y-1/2 transition-all duration-700 ease-out"
          style={{ width: `${(activeIndex / (nodes.length - 1)) * 80}%` }}
        />

        {nodes.map((node, i) => {
          const isActive = i <= activeIndex;
          const isCurrent = i === activeIndex;
          return (
            <div key={node.id} className="relative z-10 flex flex-col items-center gap-2">
              {/* Pulse ring */}
              {isCurrent && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-12 h-12 rounded-xl border border-accent/30"
                    style={{ animation: "pulse-ring 2s ease-out infinite" }}
                  />
                </div>
              )}
              <div
                className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all duration-500 ${
                  isActive
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-border bg-surface text-muted/40"
                }`}
              >
                <NodeIcon icon={node.icon} />
              </div>
              <span
                className={`text-[11px] font-mono transition-colors duration-500 ${
                  isActive ? "text-foreground/80" : "text-muted/30"
                }`}
              >
                {node.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

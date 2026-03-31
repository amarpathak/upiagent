"use client";

import { useEffect, useState, useRef } from "react";

const nodes = [
  { id: "qr", label: "Generate QR", sub: "upi://pay intent", icon: "grid" },
  { id: "pay", label: "Customer pays", sub: "any UPI app", icon: "phone" },
  { id: "connect", label: "Connect source", sub: "Gmail, SMS, more", icon: "plug" },
  { id: "ai", label: "AI verifies", sub: "LLM + security", icon: "cpu" },
];

function NodeIcon({ icon, active }: { icon: string; active: boolean }) {
  const cls = `w-5 h-5 transition-colors duration-500 ${active ? "stroke-accent" : "stroke-muted/30"}`;
  switch (icon) {
    case "grid":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "phone":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round">
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <circle cx="12" cy="18" r="1" />
        </svg>
      );
    case "plug":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22v-5" />
          <path d="M9 8V2" /><path d="M15 8V2" />
          <path d="M18 8v4a6 6 0 01-12 0V8h12z" />
        </svg>
      );
    case "cpu":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
          <path d="M15 13l2-2-2-2" />
        </svg>
      );
    default:
      return null;
  }
}

export function AnimatedFlow() {
  const [activeIndex, setActiveIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          setActiveIndex(0);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (activeIndex < 0 || activeIndex >= nodes.length) return;
    const timer = setTimeout(() => {
      setActiveIndex((i) => (i + 1 >= nodes.length ? 0 : i + 1));
    }, 2000);
    return () => clearTimeout(timer);
  }, [activeIndex]);

  return (
    <div ref={ref} className="w-full py-10 overflow-x-auto">
      <div className="flex items-start justify-between min-w-[600px] max-w-2xl mx-auto relative px-2">
        {/* Base line */}
        <div className="absolute top-6 left-[8%] right-[8%] h-px bg-border" />
        {/* Active line */}
        <div
          className="absolute top-6 left-[8%] h-px transition-all duration-700 ease-out"
          style={{
            width: `${Math.max(0, (activeIndex / (nodes.length - 1)) * 84)}%`,
            background: "linear-gradient(90deg, var(--accent), var(--cyan))",
            boxShadow: "0 0 12px var(--glow)",
          }}
        />

        {nodes.map((node, i) => {
          const isActive = i <= activeIndex;
          const isCurrent = i === activeIndex;
          return (
            <div key={node.id} className="relative z-10 flex flex-col items-center w-[100px]">
              {isCurrent && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2">
                  <div
                    className="w-12 h-12 rounded-xl border border-accent/30"
                    style={{ animation: "pulse-ring 2s ease-out infinite" }}
                  />
                </div>
              )}
              <div
                className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all duration-500 ${
                  isActive
                    ? "border-accent/30 bg-accent/[0.06]"
                    : "border-border bg-surface"
                }`}
              >
                <NodeIcon icon={node.icon} active={isActive} />
              </div>
              <span
                className={`text-[11px] font-mono text-center leading-tight mt-2.5 transition-colors duration-500 ${
                  isActive ? "text-foreground/80" : "text-muted/25"
                }`}
              >
                {node.label}
              </span>
              <span
                className={`text-[9px] font-mono text-center leading-tight mt-0.5 transition-colors duration-500 ${
                  isActive ? "text-muted/50" : "text-muted/15"
                }`}
              >
                {node.sub}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";

const nodes = [
  { id: "qr", label: "Generate QR", icon: "grid" },
  { id: "pay", label: "Customer pays", icon: "phone" },
  { id: "source", label: "Alert ingested", icon: "layers" },
  { id: "llm", label: "LLM parses", icon: "cpu" },
  { id: "verify", label: "Verified", icon: "check" },
];

function NodeIcon({ icon, active }: { icon: string; active: boolean }) {
  const cls = `w-5 h-5 transition-colors duration-500 ${active ? "stroke-accent" : "stroke-muted/40"}`;
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
    case "layers":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      );
    case "cpu":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
          <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
          <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
          <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="15" x2="23" y2="15" />
          <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="15" x2="4" y2="15" />
        </svg>
      );
    case "check":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <path d="M22 4L12 14.01l-3-3" />
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
    }, 1800);
    return () => clearTimeout(timer);
  }, [activeIndex]);

  return (
    <div ref={ref} className="w-full py-10 overflow-x-auto">
      <div className="flex items-center justify-between min-w-[540px] max-w-2xl mx-auto relative px-4">
        {/* Base line */}
        <div className="absolute top-6 left-[10%] right-[10%] h-px bg-border" />
        {/* Active line */}
        <div
          className="absolute top-6 left-[10%] h-px transition-all duration-700 ease-out"
          style={{
            width: `${Math.max(0, (activeIndex / (nodes.length - 1)) * 80)}%`,
            background: "linear-gradient(90deg, var(--accent), var(--cyan))",
            boxShadow: "0 0 8px var(--glow)",
          }}
        />

        {nodes.map((node, i) => {
          const isActive = i <= activeIndex;
          const isCurrent = i === activeIndex;
          return (
            <div key={node.id} className="relative z-10 flex flex-col items-center gap-2.5 w-24">
              {isCurrent && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2">
                  <div
                    className="w-12 h-12 rounded-xl border border-accent/40"
                    style={{ animation: "pulse-ring 2s ease-out infinite" }}
                  />
                </div>
              )}
              <div
                className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all duration-500 ${
                  isActive
                    ? "border-accent/40 bg-accent/[0.08]"
                    : "border-border bg-surface"
                }`}
              >
                <NodeIcon icon={node.icon} active={isActive} />
              </div>
              <span
                className={`text-[10px] font-mono text-center leading-tight transition-colors duration-500 ${
                  isActive ? "text-foreground/70" : "text-muted/30"
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

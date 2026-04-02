"use client";

import { useState, useEffect } from "react";

const sections = [
  { id: "install", label: "Install" },
  { id: "quick-start", label: "Quick start" },
  { id: "generate-qr", label: "Generate QR" },
  { id: "verify-payment", label: "Verify payment" },
  { id: "security-layers", label: "Security layers" },
  { id: "webhooks", label: "Webhooks" },
  { id: "gmail-setup", label: "Gmail setup" },
  { id: "llm-providers", label: "LLM providers" },
  { id: "api-reference", label: "API reference" },
  { id: "error-handling", label: "Error handling" },
  { id: "examples", label: "Examples" },
];

export function DocsNav() {
  const [active, setActive] = useState("install");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <aside className="hidden lg:block w-48 shrink-0">
      <div className="sticky top-24">
        <p className="font-mono text-[10px] text-muted uppercase tracking-[0.2em] mb-4">
          On this page
        </p>
        <nav className="flex flex-col gap-1">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={`text-[13px] py-1 transition-colors ${
                active === section.id
                  ? "text-foreground font-medium"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="mt-8 pt-4 border-t border-border">
          <a
            href="https://github.com/AmarPathak/upiagent"
            className="text-[12px] text-muted hover:text-foreground transition-colors"
          >
            GitHub
          </a>
          <span className="text-muted/30 mx-2">/</span>
          <a
            href="https://www.npmjs.com/package/upiagent"
            className="text-[12px] text-muted hover:text-foreground transition-colors"
          >
            npm
          </a>
        </div>
      </div>
    </aside>
  );
}

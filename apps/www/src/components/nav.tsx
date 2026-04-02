"use client";

import { motion } from "@/components/motion-client";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001";

const links = [
  { label: "How it works", href: "/#how" },
  { label: "Live demo", href: "/#demo" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Docs", href: "/docs" },
];

export function Nav() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl"
    >
      <div className="max-w-[1100px] mx-auto flex items-center justify-between px-8 h-14">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-accent-green via-accent-blue to-accent-purple flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="4" height="4" rx="0.5" />
              <rect x="9" y="3" width="4" height="4" rx="0.5" />
              <rect x="3" y="9" width="4" height="4" rx="0.5" />
              <circle cx="11" cy="11" r="2" />
            </svg>
          </div>
          <span className="font-mono text-sm font-medium tracking-tight">upiagent</span>
        </div>

        <div className="hidden sm:flex items-center gap-8">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] text-muted hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <a
          href={`${DASHBOARD_URL}/signup`}
          className="px-5 py-2 bg-foreground text-background rounded-lg text-[13px] font-medium hover:bg-foreground/90 transition-colors"
        >
          Get started free
        </a>
      </div>
    </motion.nav>
  );
}

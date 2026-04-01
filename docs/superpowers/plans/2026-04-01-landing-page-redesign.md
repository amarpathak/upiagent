# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the upiagent landing page from dark hacker-terminal to light editorial with Motion scroll animations, mesh gradients, and Instrument Serif typography.

**Architecture:** Replace the existing `page.tsx` monolith with composable section components. Add `motion` library for scroll-triggered animations. Swap Geist fonts for Instrument Serif + DM Sans + JetBrains Mono. Rewrite `globals.css` with new light-mode design tokens. Keep existing `live-demo.tsx`, `terminal.tsx`, `code-block.tsx`, `security-layer.tsx` but restyle them to match.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Motion (framer-motion), next/font/google

**Spec:** `docs/superpowers/specs/2026-04-01-landing-page-redesign-design.md`

---

## File Structure

```
apps/www/src/
├── app/
│   ├── layout.tsx              — MODIFY: swap fonts, remove dark class, add MotionConfig
│   ├── page.tsx                — REWRITE: compose new section components
│   └── globals.css             — REWRITE: light-mode design tokens, remove old animations
├── components/
│   ├── motion-client.tsx       — CREATE: "use client" motion export wrapper
│   ├── nav.tsx                 — CREATE: sticky nav with backdrop blur
│   ├── hero.tsx                — CREATE: hero with load animations + strikethrough
│   ├── product-flow.tsx        — CREATE: 4-step animated flow on gradient backdrop
│   ├── trust-stats.tsx         — CREATE: trust bar + animated stats counter
│   ├── how-it-works.tsx        — CREATE: detailed 4-step cards
│   ├── live-demo-section.tsx   — CREATE: cinematic wrapper + expandable real demo
│   ├── quick-start-security.tsx — CREATE: code + security two-column
│   ├── pricing-cta.tsx         — CREATE: pricing table + final CTA
│   ├── footer-new.tsx          — CREATE: light footer matching new brand
│   ├── hero-canvas.tsx         — DELETE (replaced by gradient + motion)
│   ├── animated-flow.tsx       — DELETE (replaced by product-flow.tsx)
│   ├── live-demo.tsx           — KEEP: restyle colors only
│   ├── terminal.tsx            — KEEP: restyle colors only
│   ├── code-block.tsx          — KEEP: restyle colors only
│   └── security-layer.tsx      — KEEP: restyle colors only
```

---

### Task 1: Install Motion + New Fonts

**Files:**
- Modify: `apps/www/package.json`
- Modify: `apps/www/src/app/layout.tsx`

- [ ] **Step 1: Install motion**

```bash
cd apps/www && pnpm add motion
```

- [ ] **Step 2: Update layout.tsx — swap fonts and remove dark mode**

Replace the entire `apps/www/src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Instrument_Serif, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "upiagent — UPI payments without a payment gateway",
  description:
    "Open-source UPI payment verification. Generate QR, verify via Gmail + AI. No Razorpay, no fees, no merchant onboarding.",
  openGraph: {
    title: "upiagent",
    description: "UPI payments without a payment gateway",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verify fonts load**

```bash
cd apps/www && pnpm dev
```

Open http://localhost:3000 — page will look broken (expected, we haven't updated globals.css yet). Check browser DevTools Network tab to confirm `Instrument_Serif`, `DM_Sans`, `JetBrains_Mono` fonts are loading. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/www/package.json apps/www/pnpm-lock.yaml apps/www/src/app/layout.tsx
git commit -m "chore: install motion, swap fonts to Instrument Serif + DM Sans + JetBrains Mono"
```

---

### Task 2: Rewrite globals.css — Light Mode Design Tokens

**Files:**
- Rewrite: `apps/www/src/app/globals.css`

- [ ] **Step 1: Replace globals.css**

Replace entire `apps/www/src/app/globals.css` with:

```css
@import "tailwindcss";

:root {
  --background: #fdfcfa;
  --foreground: #1a1a1a;
  --muted: #888;
  --muted-light: #ccc;
  --border: #f0ece4;
  --border-hover: #e5e2da;
  --accent-green: #059669;
  --accent-blue: #3b82f6;
  --accent-purple: #8b5cf6;
  --surface: #fff;
  --surface-raised: #f8f7f4;
  --strike-red: #ef4444;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-muted-light: var(--muted-light);
  --color-border: var(--border);
  --color-border-hover: var(--border-hover);
  --color-accent-green: var(--accent-green);
  --color-accent-blue: var(--accent-blue);
  --color-accent-purple: var(--accent-purple);
  --color-surface: var(--surface);
  --color-surface-raised: var(--surface-raised);
  --color-strike-red: var(--strike-red);
  --font-sans: var(--font-dm-sans), system-ui, sans-serif;
  --font-serif: var(--font-instrument-serif), Georgia, serif;
  --font-mono: var(--font-jetbrains-mono), monospace;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}

::selection {
  background: var(--accent-green);
  color: #fff;
}

/* Terminal cursor blink — kept for live demo */
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
.cursor-blink {
  animation: blink 1s step-end infinite;
}

/* Strikethrough animation */
@keyframes strike-in {
  from { transform: scaleX(0) rotate(-1deg); }
  to { transform: scaleX(1) rotate(-1deg); }
}

/* Gradient text shimmer */
@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

/* Orb floating */
@keyframes orb-float-1 {
  0%, 100% { transform: translate(0, 0); }
  33% { transform: translate(30px, -20px); }
  66% { transform: translate(-20px, -10px); }
}
@keyframes orb-float-2 {
  0%, 100% { transform: translate(0, 0); }
  33% { transform: translate(-25px, 15px); }
  66% { transform: translate(15px, 25px); }
}
@keyframes orb-float-3 {
  0%, 100% { transform: translate(0, 0); }
  33% { transform: translate(20px, 20px); }
  66% { transform: translate(-30px, -15px); }
}

/* Smooth reveal — kept for live demo lines */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-line {
  animation: fadeInUp 0.3s ease-out both;
}

/* Scrollbar */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-hover); border-radius: 2px; }
```

- [ ] **Step 2: Commit**

```bash
git add apps/www/src/app/globals.css
git commit -m "style: rewrite globals.css with light-mode design tokens"
```

---

### Task 3: Create Motion Client Wrapper

**Files:**
- Create: `apps/www/src/components/motion-client.tsx`

- [ ] **Step 1: Create the wrapper**

Create `apps/www/src/components/motion-client.tsx`:

```tsx
"use client";

export * from "motion/react-client";
export { AnimatePresence, MotionConfig, LazyMotion, domAnimation } from "motion/react";
export { useScroll, useTransform, useMotionValue, useInView } from "motion/react";
```

- [ ] **Step 2: Commit**

```bash
git add apps/www/src/components/motion-client.tsx
git commit -m "feat: add motion client wrapper for Next.js App Router"
```

---

### Task 4: Build Nav Component

**Files:**
- Create: `apps/www/src/components/nav.tsx`

- [ ] **Step 1: Create nav.tsx**

Create `apps/www/src/components/nav.tsx`:

```tsx
"use client";

import { motion } from "@/components/motion-client";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001";

const links = [
  { label: "How it works", href: "#how" },
  { label: "Live demo", href: "#demo" },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "#quickstart" },
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/www/src/components/nav.tsx
git commit -m "feat: add sticky nav component with gradient logo mark"
```

---

### Task 5: Build Hero Component

**Files:**
- Create: `apps/www/src/components/hero.tsx`

- [ ] **Step 1: Create hero.tsx**

Create `apps/www/src/components/hero.tsx`:

```tsx
"use client";

import { motion } from "@/components/motion-client";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001";

export function Hero() {
  return (
    <section className="pt-32 pb-12 px-8">
      <div className="max-w-[800px] mx-auto text-center">
        {/* Pill badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full text-[12px] text-muted border border-border bg-gradient-to-r from-accent-green/5 to-accent-blue/5"
        >
          <span className="w-[18px] h-[18px] rounded-full bg-gradient-to-br from-accent-green to-accent-blue flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 6h8M6 2l4 4-4 4" />
            </svg>
          </span>
          Open source · Built in India · Zero fees
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="font-serif text-[54px] font-normal leading-[1.1] tracking-[-1.5px] mb-5"
        >
          Stop paying{" "}
          <span className="relative inline-block">
            <span className="text-muted-light">gateway fees.</span>
            <span
              className="absolute left-[-4px] right-[-4px] top-[52%] h-[3px] rounded-sm bg-gradient-to-r from-red-400 to-strike-red origin-left"
              style={{ animation: "strike-in 0.7s cubic-bezier(0.25,0.46,0.45,0.94) 0.6s both" }}
            />
          </span>
          <br />
          Start{" "}
          <span
            className="italic bg-gradient-to-r from-accent-green via-accent-blue to-accent-purple bg-clip-text text-transparent bg-[length:200%_200%]"
            style={{ animation: "gradient-shift 4s ease-in-out infinite" }}
          >
            keeping everything.
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-[16px] text-muted leading-[1.7] max-w-[480px] mx-auto mb-8"
        >
          Generate a QR. Customer pays with <strong className="text-foreground/70 font-medium">any UPI app</strong>.
          AI verifies in seconds. Money lands in <strong className="text-foreground/70 font-medium">your bank</strong> — not ours.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex items-center justify-center gap-3 mb-4"
        >
          <a
            href={`${DASHBOARD_URL}/signup`}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-foreground text-background text-[14px] font-medium hover:bg-foreground/90 transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            Start building
            <svg className="w-4 h-4" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.75 9h10.5M10.5 5.25L14.25 9l-3.75 3.75" />
            </svg>
          </a>
          <a
            href="#demo"
            className="px-7 py-3 rounded-xl border-[1.5px] border-border text-[14px] text-muted hover:border-border-hover hover:text-foreground transition-all"
          >
            See the live demo
          </a>
        </motion.div>

        {/* npm hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          className="font-mono text-[12px] text-muted-light"
        >
          or run{" "}
          <code className="bg-accent-green/5 border border-accent-green/10 px-2.5 py-0.5 rounded-md text-muted">
            npm i upiagent
          </code>
        </motion.p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/www/src/components/hero.tsx
git commit -m "feat: add hero component with strikethrough + gradient text animations"
```

---

### Task 6: Build Product Flow Component

**Files:**
- Create: `apps/www/src/components/product-flow.tsx`

- [ ] **Step 1: Create product-flow.tsx**

Create `apps/www/src/components/product-flow.tsx`:

```tsx
"use client";

import { motion, useInView } from "@/components/motion-client";
import { useRef } from "react";

const steps = [
  { icon: "⬜", label: "Generate QR", detail: "UPI intent URL" },
  { icon: "📱", label: "Customer pays", detail: "Any UPI app" },
  { icon: "📧", label: "Gmail alert", detail: "Bank notification" },
  { icon: "✓", label: "AI verified", detail: "4-layer security" },
];

export function ProductFlow() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="px-8 pb-16">
      <div className="max-w-[1100px] mx-auto">
        <div
          ref={ref}
          className="relative w-full rounded-2xl overflow-hidden border border-border/50 p-12"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 20% 80%, rgba(110,231,183,0.2) 0%, transparent 60%),
              radial-gradient(ellipse 60% 80% at 80% 20%, rgba(59,130,246,0.15) 0%, transparent 60%),
              radial-gradient(ellipse 50% 50% at 60% 70%, rgba(167,139,250,0.12) 0%, transparent 60%),
              linear-gradient(180deg, #fdfcfa 0%, #f4f2ed 100%)
            `,
          }}
        >
          {/* Subtle grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          {/* Animated orbs */}
          <div className="absolute w-[300px] h-[300px] rounded-full bottom-[-80px] left-[5%] opacity-50 blur-[60px] bg-gradient-to-br from-emerald-300 to-emerald-400" style={{ animation: "orb-float-1 8s ease-in-out infinite" }} />
          <div className="absolute w-[250px] h-[250px] rounded-full top-[-60px] right-[10%] opacity-40 blur-[60px] bg-gradient-to-br from-blue-300 to-blue-400" style={{ animation: "orb-float-2 10s ease-in-out infinite" }} />
          <div className="absolute w-[200px] h-[200px] rounded-full bottom-[20%] left-[40%] opacity-30 blur-[60px] bg-gradient-to-br from-violet-300 to-violet-400" style={{ animation: "orb-float-3 12s ease-in-out infinite" }} />

          {/* Flow steps */}
          <div className="relative z-10 flex items-center justify-between gap-4">
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-4 flex-1">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={isInView ? { opacity: 1, scale: 1, y: 0 } : {}}
                  transition={{
                    duration: 0.5,
                    delay: i * 0.3,
                    type: "spring",
                    stiffness: 100,
                    damping: 15,
                  }}
                  className="flex-shrink-0 bg-white/85 backdrop-blur-md border border-white/60 rounded-2xl p-5 shadow-sm text-center min-w-[140px]"
                >
                  <div className="text-2xl mb-2">{step.icon}</div>
                  <div className="text-[14px] font-semibold mb-0.5">{step.label}</div>
                  <div className="text-[11px] text-muted">{step.detail}</div>
                </motion.div>

                {/* Connector arrow */}
                {i < steps.length - 1 && (
                  <motion.div
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={isInView ? { opacity: 1, scaleX: 1 } : {}}
                    transition={{ duration: 0.4, delay: i * 0.3 + 0.2 }}
                    className="flex-1 h-[2px] bg-gradient-to-r from-accent-green/30 to-accent-blue/30 origin-left"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/www/src/components/product-flow.tsx
git commit -m "feat: add product flow with mesh gradient backdrop and staggered reveal"
```

---

### Task 7: Build Trust + Stats Component

**Files:**
- Create: `apps/www/src/components/trust-stats.tsx`

- [ ] **Step 1: Create trust-stats.tsx**

Create `apps/www/src/components/trust-stats.tsx`:

```tsx
"use client";

import { motion, useInView, useMotionValue, useTransform } from "@/components/motion-client";
import { useRef, useEffect, useState } from "react";

const upiApps = ["Google Pay", "PhonePe", "Paytm", "CRED", "BHIM", "Amazon Pay"];

function AnimatedNumber({ value, suffix = "" }: { value: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!isInView) return;
    // Simple number animation for pure numeric values
    const num = parseFloat(value.replace(/[^0-9.]/g, ""));
    if (isNaN(num)) {
      setDisplay(value);
      return;
    }
    let start = 0;
    const duration = 1500;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = start + (num - start) * eased;
      if (value.includes("%")) setDisplay(`${Math.round(current)}%`);
      else if (value.includes("$")) setDisplay(`~$${current.toFixed(3)}`);
      else if (value.includes("s")) setDisplay(`<${Math.round(current)}s`);
      else setDisplay(value);
      if (progress < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [isInView, value]);

  return <span ref={ref}>{display}{suffix}</span>;
}

export function TrustStats() {
  const trustRef = useRef<HTMLDivElement>(null);
  const trustInView = useInView(trustRef, { once: true });

  return (
    <>
      {/* Trust bar */}
      <section className="px-8 py-10 text-center" ref={trustRef}>
        <div className="max-w-[1100px] mx-auto">
          <p className="text-[11px] text-muted-light tracking-[2px] uppercase font-medium mb-5">
            Works with every UPI app
          </p>
          <div className="flex justify-center gap-10 flex-wrap">
            {upiApps.map((app, i) => (
              <motion.span
                key={app}
                initial={{ opacity: 0, y: 8 }}
                animate={trustInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="text-[15px] font-semibold text-muted-light/80 tracking-tight"
              >
                {app}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-8">
        <div className="max-w-[720px] mx-auto grid grid-cols-3 gap-6 py-8 border-t border-border">
          {[
            { value: "0%", label: "Transaction fees", isGradient: true },
            { value: "~$0.001", label: "Per verification", isGradient: false },
            { value: "<10s", label: "Verification time", isGradient: false },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className={`font-serif text-[36px] tracking-tight leading-none mb-1 ${stat.isGradient ? "bg-gradient-to-r from-accent-green to-accent-blue bg-clip-text text-transparent" : "text-foreground"}`}>
                <AnimatedNumber value={stat.value} />
              </div>
              <div className="text-[12px] text-muted-light">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/www/src/components/trust-stats.tsx
git commit -m "feat: add trust bar with staggered reveal + animated stat counters"
```

---

### Task 8: Build How It Works Component

**Files:**
- Create: `apps/www/src/components/how-it-works.tsx`

- [ ] **Step 1: Create how-it-works.tsx**

Create `apps/www/src/components/how-it-works.tsx`:

```tsx
"use client";

import { motion, useInView } from "@/components/motion-client";
import { useRef } from "react";

const steps = [
  {
    num: "01",
    title: "Generate QR",
    desc: "Create a UPI intent QR with amount and your VPA. Works with any bank.",
  },
  {
    num: "02",
    title: "Customer pays",
    desc: "Scan with GPay, PhonePe, Paytm. Money goes directly to your bank.",
  },
  {
    num: "03",
    title: "Connect Gmail",
    desc: "Bank sends confirmation email. upiagent reads it automatically via OAuth.",
  },
  {
    num: "04",
    title: "AI verifies",
    desc: "LLM parses the email. Matches amount, time, dedup. Payment confirmed.",
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="how" className="px-8 py-16" ref={ref}>
      <div className="max-w-[1100px] mx-auto">
        <div className="border-t border-border pt-16" />

        <div className="text-center mb-12">
          <p className="text-[11px] text-muted-light tracking-[2px] uppercase mb-3">How it works</p>
          <h2 className="font-serif text-[36px] font-normal tracking-tight">
            Four steps.{" "}
            <em className="italic bg-gradient-to-r from-accent-green to-accent-blue bg-clip-text text-transparent">
              No middleman.
            </em>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.4,
                delay: i * 0.1,
                type: "spring",
                stiffness: 100,
                damping: 15,
              }}
              className="p-6 rounded-2xl border border-border bg-surface hover:border-border-hover hover:shadow-sm transition-all"
            >
              <div className="font-serif text-[32px] text-border mb-3">{step.num}</div>
              <h3 className="text-[15px] font-semibold mb-1.5 tracking-tight">{step.title}</h3>
              <p className="text-[13px] text-muted leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/www/src/components/how-it-works.tsx
git commit -m "feat: add how-it-works section with staggered card reveal"
```

---

### Task 9: Build Live Demo Section Wrapper

**Files:**
- Create: `apps/www/src/components/live-demo-section.tsx`

- [ ] **Step 1: Create live-demo-section.tsx**

This wraps the existing `LiveDemo` component with scroll animation and the new styling.

Create `apps/www/src/components/live-demo-section.tsx`:

```tsx
"use client";

import { motion, useInView } from "@/components/motion-client";
import { useRef } from "react";
import { LiveDemo } from "./live-demo";

export function LiveDemoSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="demo" className="px-8 py-16" ref={ref}>
      <div className="max-w-[800px] mx-auto">
        <div className="border-t border-border pt-16" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[11px] text-muted-light tracking-[2px] uppercase mb-3">Try it</p>
          <h2 className="font-serif text-[36px] font-normal tracking-tight mb-2">
            Live demo
          </h2>
          <p className="text-muted text-[15px] mb-10">
            Real QR code. Real verification. Not a simulation.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <LiveDemo />
        </motion.div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/www/src/components/live-demo-section.tsx
git commit -m "feat: add live demo section wrapper with scroll reveal"
```

---

### Task 10: Build Quick Start + Security Section

**Files:**
- Create: `apps/www/src/components/quick-start-security.tsx`

- [ ] **Step 1: Create quick-start-security.tsx**

Create `apps/www/src/components/quick-start-security.tsx`:

```tsx
"use client";

import { motion, useInView } from "@/components/motion-client";
import { useRef } from "react";
import { CodeBlock } from "./code-block";
import { SecurityLayer } from "./security-layer";

const installCode = `npm install upiagent`;

const quickStart = `import { UpiAgent } from "upiagent"

const agent = new UpiAgent({
  merchant: { upiId: "you@ybl", name: "Your Store" },
  gmail: { clientId: "...", clientSecret: "...", refreshToken: "..." },
  llm: { provider: "openai", apiKey: process.env.OPENAI_KEY },
})

const payment = await agent.createPayment({ amount: 499, note: "Order #1" })
const result  = await agent.verifyPayment({ expectedAmount: 499 })

result.verified          // true
result.confidence        // 0.95`;

const securityLayers = [
  { num: "01", name: "Format Validation", desc: "Zod schema catches LLM hallucinations before they enter your system." },
  { num: "02", name: "Amount Matching", desc: "Exact match to the paisa. No fuzzy matching on financial data." },
  { num: "03", name: "Time Window", desc: "Configurable window blocks replay attacks from stale emails." },
  { num: "04", name: "Duplicate Detection", desc: "UPI reference ID tracking prevents double-crediting." },
];

export function QuickStartSecurity() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="quickstart" className="px-8 py-16" ref={ref}>
      <div className="max-w-[1100px] mx-auto">
        <div className="border-t border-border pt-16" />

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Left — Quick Start */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, type: "spring", stiffness: 100, damping: 15 }}
          >
            <p className="text-[11px] text-muted-light tracking-[2px] uppercase mb-3">For developers</p>
            <h2 className="font-serif text-[36px] font-normal tracking-tight mb-8">
              Five minutes to<br />
              <em className="italic bg-gradient-to-r from-accent-green to-accent-blue bg-clip-text text-transparent">
                first payment.
              </em>
            </h2>
            <div className="space-y-4">
              <CodeBlock code={installCode} lang="bash" filename="terminal" />
              <CodeBlock code={quickStart} lang="typescript" filename="app.ts" />
            </div>
          </motion.div>

          {/* Right — Security */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.15, type: "spring", stiffness: 100, damping: 15 }}
          >
            <p className="text-[11px] text-muted-light tracking-[2px] uppercase mb-3">4-layer verification</p>
            <h2 className="font-serif text-[36px] font-normal tracking-tight mb-8">
              Every payment<br />
              <em className="italic text-foreground/60">verified four ways.</em>
            </h2>
            <div className="grid gap-3">
              {securityLayers.map((layer, i) => (
                <motion.div
                  key={layer.num}
                  initial={{ opacity: 0, y: 10 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.3, delay: 0.3 + i * 0.1 }}
                >
                  <SecurityLayer {...layer} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/www/src/components/quick-start-security.tsx
git commit -m "feat: add quick-start + security two-column section with scroll reveals"
```

---

### Task 11: Build Pricing + CTA Component

**Files:**
- Create: `apps/www/src/components/pricing-cta.tsx`

- [ ] **Step 1: Create pricing-cta.tsx**

Create `apps/www/src/components/pricing-cta.tsx`:

```tsx
"use client";

import { motion, useInView } from "@/components/motion-client";
import { useRef } from "react";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001";

const models = [
  { name: "Gemini Flash (free tier)", cost: "~$0.0001", per1k: "~$0.10", highlight: true },
  { name: "GPT-4o-mini", cost: "~$0.001", per1k: "~$1.00", highlight: false },
  { name: "Claude Sonnet", cost: "~$0.003", per1k: "~$3.00", highlight: false },
];

export function PricingCta() {
  const pricingRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const pricingInView = useInView(pricingRef, { once: true, margin: "-80px" });
  const ctaInView = useInView(ctaRef, { once: true, margin: "-80px" });

  return (
    <>
      {/* Pricing */}
      <section id="pricing" className="px-8 py-16" ref={pricingRef}>
        <div className="max-w-[800px] mx-auto">
          <div className="border-t border-border pt-16" />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={pricingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
          >
            <p className="text-[11px] text-muted-light tracking-[2px] uppercase mb-3">Pricing</p>
            <h2 className="font-serif text-[36px] font-normal tracking-tight mb-2">
              Pay for AI tokens, not transactions.
            </h2>
            <p className="text-muted text-[15px] mb-10">
              Razorpay charges 2% per transaction. On &#8377;499, that&apos;s &#8377;9.98. upiagent costs &#8377;0.008.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={pricingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="rounded-2xl border border-border overflow-hidden"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-raised">
                  <th className="px-5 py-3.5 text-left text-[11px] text-muted-light font-medium uppercase tracking-wider">Model</th>
                  <th className="px-5 py-3.5 text-left text-[11px] text-muted-light font-medium uppercase tracking-wider">Per verification</th>
                  <th className="px-5 py-3.5 text-left text-[11px] text-muted-light font-medium uppercase tracking-wider">1K verifications</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[13px]">
                {models.map((m, i) => (
                  <tr key={m.name} className={i < models.length - 1 ? "border-b border-border" : ""}>
                    <td className="px-5 py-3.5 text-foreground/70">{m.name}</td>
                    <td className={`px-5 py-3.5 ${m.highlight ? "text-accent-green font-semibold" : "text-muted"}`}>{m.cost}</td>
                    <td className="px-5 py-3.5 text-muted-light">{m.per1k}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          <p className="text-[12px] text-muted-light mt-4">
            Default is Gemini (free tier). Bring your own key for any model.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-8 py-24 relative overflow-hidden" ref={ctaRef}>
        {/* Gradient background that intensifies */}
        <motion.div
          initial={{ opacity: 0.3 }}
          animate={ctaInView ? { opacity: 1 } : {}}
          transition={{ duration: 1 }}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 60% 80% at 50% 100%, rgba(110,231,183,0.12) 0%, transparent 60%),
              radial-gradient(ellipse 40% 60% at 30% 80%, rgba(59,130,246,0.08) 0%, transparent 60%),
              radial-gradient(ellipse 40% 60% at 70% 80%, rgba(167,139,250,0.06) 0%, transparent 60%)
            `,
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={ctaInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="relative max-w-[600px] mx-auto text-center"
        >
          <h2 className="font-serif text-[36px] font-normal tracking-tight mb-4">
            Start accepting payments today.
          </h2>
          <p className="text-muted text-[15px] mb-8">
            No sign-up. No approval. No fees. Just npm install.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a
              href={`${DASHBOARD_URL}/signup`}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-foreground text-background text-[14px] font-medium hover:bg-foreground/90 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              Get started free
            </a>
            <a
              href="https://github.com/AmarPathak/upiagent"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl border-[1.5px] border-border text-[14px] text-muted hover:border-border-hover hover:text-foreground transition-all"
            >
              Star on GitHub
            </a>
          </div>
        </motion.div>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/www/src/components/pricing-cta.tsx
git commit -m "feat: add pricing table + final CTA with gradient intensify on scroll"
```

---

### Task 12: Build Footer Component

**Files:**
- Create: `apps/www/src/components/footer-new.tsx`

- [ ] **Step 1: Create footer-new.tsx**

Create `apps/www/src/components/footer-new.tsx`:

```tsx
export function FooterNew() {
  return (
    <footer className="bg-surface-raised border-t border-border">
      {/* Giant wordmark */}
      <div className="px-8 pt-20 pb-8">
        <div className="max-w-[1100px] mx-auto">
          <span className="block font-mono font-bold text-[clamp(4rem,15vw,11rem)] leading-[0.85] tracking-[-0.06em] text-foreground/[0.04] select-none">
            upi
            <br />
            agent
          </span>
        </div>
      </div>

      {/* Links */}
      <div className="px-8 pb-16">
        <div className="max-w-[1100px] mx-auto flex flex-wrap justify-end gap-x-14 gap-y-8">
          <div className="flex flex-col gap-2.5">
            <span className="font-mono text-[10px] text-muted-light uppercase tracking-[0.2em]">Product</span>
            <a href="#how" className="text-[13px] text-muted hover:text-foreground transition-colors">How it works</a>
            <a href="#demo" className="text-[13px] text-muted hover:text-foreground transition-colors">Live demo</a>
            <a href="#quickstart" className="text-[13px] text-muted hover:text-foreground transition-colors">Docs</a>
            <a href="#pricing" className="text-[13px] text-muted hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="font-mono text-[10px] text-muted-light uppercase tracking-[0.2em]">Source</span>
            <a href="https://github.com/AmarPathak/upiagent" className="text-[13px] text-muted hover:text-foreground transition-colors">GitHub</a>
            <a href="https://www.npmjs.com/package/upiagent" className="text-[13px] text-muted hover:text-foreground transition-colors">npm</a>
            <a href="https://github.com/AmarPathak/upiagent/issues" className="text-[13px] text-muted hover:text-foreground transition-colors">Issues</a>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="font-mono text-[10px] text-muted-light uppercase tracking-[0.2em]">Connect</span>
            <a href="https://github.com/AmarPathak" className="text-[13px] text-muted hover:text-foreground transition-colors">GitHub</a>
            <a href="https://x.com/AmarPathak" className="text-[13px] text-muted hover:text-foreground transition-colors">X / Twitter</a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-8 py-5 border-t border-border">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-light">
            MIT · {new Date().getFullYear()}
          </span>
          <div className="flex items-center gap-5">
            <a href="https://github.com/AmarPathak/upiagent" className="text-muted-light hover:text-foreground transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
            <a href="https://x.com/AmarPathak" className="text-muted-light hover:text-foreground transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/www/src/components/footer-new.tsx
git commit -m "feat: add light-mode footer component"
```

---

### Task 13: Rewrite page.tsx — Compose All Sections

**Files:**
- Rewrite: `apps/www/src/app/page.tsx`
- Delete: `apps/www/src/components/hero-canvas.tsx`
- Delete: `apps/www/src/components/animated-flow.tsx`

- [ ] **Step 1: Rewrite page.tsx**

Replace entire `apps/www/src/app/page.tsx` with:

```tsx
import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { ProductFlow } from "@/components/product-flow";
import { TrustStats } from "@/components/trust-stats";
import { HowItWorks } from "@/components/how-it-works";
import { LiveDemoSection } from "@/components/live-demo-section";
import { QuickStartSecurity } from "@/components/quick-start-security";
import { PricingCta } from "@/components/pricing-cta";
import { FooterNew } from "@/components/footer-new";

export default function Home() {
  return (
    <main className="flex flex-col">
      <Nav />
      <Hero />
      <ProductFlow />
      <TrustStats />
      <HowItWorks />
      <LiveDemoSection />
      <QuickStartSecurity />
      <PricingCta />
      <FooterNew />
    </main>
  );
}
```

- [ ] **Step 2: Delete old components**

```bash
rm apps/www/src/components/hero-canvas.tsx apps/www/src/components/animated-flow.tsx
```

- [ ] **Step 3: Verify build**

```bash
cd apps/www && pnpm build
```

Expected: Build succeeds. If there are import errors in `live-demo.tsx`, `terminal.tsx`, `code-block.tsx`, or `security-layer.tsx` due to old color token references, note them for Task 14.

- [ ] **Step 4: Commit**

```bash
git add -A apps/www/src/
git commit -m "feat: rewrite landing page with new editorial design + Motion scroll animations"
```

---

### Task 14: Restyle Existing Components for Light Mode

**Files:**
- Modify: `apps/www/src/components/live-demo.tsx`
- Modify: `apps/www/src/components/terminal.tsx`
- Modify: `apps/www/src/components/code-block.tsx`
- Modify: `apps/www/src/components/security-layer.tsx`

- [ ] **Step 1: Update color references in all 4 files**

In each file, search and replace old dark-mode token references:

| Old | New |
|-----|-----|
| `text-cyan` | `text-accent-green` |
| `text-accent` | `text-accent-blue` |
| `border-border` | `border-border` (no change) |
| `bg-surface` | `bg-surface` (no change) |
| `bg-surface-raised` | `bg-surface-raised` (no change) |
| `bg-background` | `bg-background` (no change) |
| `text-foreground` | `text-foreground` (no change) |
| `text-muted` | `text-muted` (no change) |
| Any hardcoded `#050508` or dark colors | Remove or replace with token |

Read each file, find color-specific classes, and update to use the new tokens. The terminal/code-block components should keep their dark card styling (dark bg for code blocks is standard even on light pages) — only update accent colors.

- [ ] **Step 2: Verify dev server**

```bash
cd apps/www && pnpm dev
```

Open http://localhost:3000 and scroll through every section. Check:
- All sections render
- Colors are consistent (no dark-mode artifacts)
- Terminal/code blocks have dark backgrounds (intentional contrast)
- Scroll animations fire once on enter
- No console errors

- [ ] **Step 3: Commit**

```bash
git add apps/www/src/components/live-demo.tsx apps/www/src/components/terminal.tsx apps/www/src/components/code-block.tsx apps/www/src/components/security-layer.tsx
git commit -m "style: restyle existing components for light-mode design tokens"
```

---

### Task 15: Responsive Polish + Accessibility

**Files:**
- Modify: `apps/www/src/components/hero.tsx`
- Modify: `apps/www/src/components/product-flow.tsx`
- Modify: `apps/www/src/components/quick-start-security.tsx`
- Modify: `apps/www/src/app/layout.tsx`

- [ ] **Step 1: Add MotionConfig for reduced motion**

In `apps/www/src/app/layout.tsx`, wrap the body content. Since MotionConfig is a client component, create a thin wrapper:

Add to `apps/www/src/components/motion-client.tsx`:

```tsx
// Add this export at the end of the existing file
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
```

In `layout.tsx`, import and wrap:

```tsx
import { MotionProvider } from "@/components/motion-client";

// In the return:
<body className="min-h-full flex flex-col">
  <MotionProvider>{children}</MotionProvider>
</body>
```

- [ ] **Step 2: Fix mobile responsive issues**

In `hero.tsx`: Change `text-[54px]` to `text-[clamp(2rem,7vw,54px)]`

In `product-flow.tsx`: Change the flex container to `flex-col sm:flex-row` and hide connector arrows on mobile:

```tsx
// Change the connector div to include:
className="hidden sm:block flex-1 h-[2px] ..."
```

In `quick-start-security.tsx`: The `lg:grid-cols-2` already handles mobile (stacks to 1 column).

- [ ] **Step 3: Add skip-to-content link**

In `layout.tsx`, add as first child inside body:

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-foreground focus:text-background focus:rounded-lg">
  Skip to content
</a>
```

And add `id="main-content"` to the `<main>` tag in `page.tsx`.

- [ ] **Step 4: Verify on mobile viewport**

```bash
cd apps/www && pnpm dev
```

Open http://localhost:3000, use DevTools responsive mode at 375px width. Check all sections stack properly.

- [ ] **Step 5: Final build check**

```bash
cd apps/www && pnpm build
```

Expected: Clean build, no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/www/src/
git commit -m "fix: responsive polish, accessibility (reduced motion, skip link), mobile layout"
```

---

## Summary

| Task | Component | Key animation |
|------|-----------|--------------|
| 1 | Fonts + Motion install | — |
| 2 | globals.css rewrite | CSS keyframes |
| 3 | Motion client wrapper | — |
| 4 | Nav | Fade-in on load |
| 5 | Hero | Stagger reveal, strikethrough, gradient shimmer |
| 6 | Product Flow | Stagger cards + draw lines on scroll |
| 7 | Trust + Stats | Stagger logos, count-up numbers |
| 8 | How It Works | Stagger cards on scroll |
| 9 | Live Demo wrapper | Fade-up on scroll |
| 10 | Quick Start + Security | Slide-in from left/right |
| 11 | Pricing + CTA | Fade-up, gradient intensify |
| 12 | Footer | Static |
| 13 | Page composition | Delete old, compose new |
| 14 | Restyle existing | Color token updates |
| 15 | Responsive + a11y | Reduced motion, mobile, skip link |

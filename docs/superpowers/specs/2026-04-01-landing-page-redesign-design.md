# upiagent Landing Page Redesign — Design Spec

**Date**: 2026-04-01
**Author**: Amar + Claude
**Status**: Draft

---

## 1. Vision

Redesign the upiagent landing page from a dark developer-terminal aesthetic to a **premium editorial light-mode page** with bold typography, mesh gradients, and scroll-driven animations. Target: $20K agency-quality brand feel. Gen Z energy in the copy, premium craft in the layout.

**Core tension**: The rebellion is in the message ("screw gateway fees"), the luxury is in the craft.

---

## 2. Target Audience

**Dual audience, developer-first:**
- **Primary**: Developers / indie hackers building payment flows — they convert via `npm install` CTA and code examples
- **Secondary**: Small merchants / business owners — they convert via "Get started free" CTA and visual product explanation

Both audiences are served on every section. No separate paths — one page tells one story that works for both.

---

## 3. Design System

### Typography
- **Headlines**: Instrument Serif, 400 weight, italic for accents
  - h1: 54px, letter-spacing -1.5px
  - h2: 36px, letter-spacing -1px
  - Section labels: 11px, uppercase, letter-spacing 2px, color #ccc
- **Body**: DM Sans, 400/500/600 weights
  - Body: 16px, line-height 1.7
  - Small: 13px
  - Nav: 13px
- **Code**: JetBrains Mono, 400/500 weights
  - Inline code: 12px
  - Code blocks: 13px

### Colors
- **Background**: #fdfcfa (warm off-white)
- **Text**: #1a1a1a (primary), #555 (secondary), #888 (muted), #ccc (faint)
- **Primary gradient**: linear-gradient(135deg, #059669, #0ea5e9, #8b5cf6) — green → blue → purple
- **Accent green**: #059669 (used for italic text, success states)
- **Accent blue**: #3b82f6 (used for links, verification)
- **Strike red**: linear-gradient(90deg, #f87171, #ef4444) — for the strikethrough
- **Borders**: #f0ece4 (light warm gray), #e5e2da (hover)
- **Card backgrounds**: rgba(255,255,255,0.85) with backdrop-filter: blur(12px)

### Gradient System
- **Mesh gradient backdrop**: Layered radial gradients (green/blue/purple/amber) with animated orbs — used behind the product flow, NOT as standalone decoration
- **Gradient text**: Used sparingly on key phrases ("keeping everything", "No middleman")
- **Gradient accents**: Logo mark, pill borders, stat values, section header accents
- **Rule**: Gradients always serve content. Never a standalone decorative block.

### Spacing
- Max content width: 1100px
- Section padding: 64px vertical
- Card padding: 24px
- Card border-radius: 16px
- Button border-radius: 10px (primary), 100px (pill)
- Component gap: 24px grid, 12px inline

### Components
- **Pill badge**: gradient border, small icon, text — used for announcements
- **Step card**: border, step number (Instrument Serif, light color), title, description
- **Glassmorphic card**: white 85% opacity, backdrop blur, subtle border — floats over gradients
- **Terminal card**: dark (#0a0a0f) with colored dots, monospace text, animated line reveals
- **CTA buttons**: Dark fill primary, outline secondary, both 12px 28px padding

---

## 4. Page Sections (7 total)

### Section 1: Hero
**Layout**: Centered, max-width 800px

**Content**:
- Announcement pill: "Open source · Built in India · Zero fees"
- Headline (Instrument Serif 54px):
  ```
  Stop paying [gateway fees.] ← red strikethrough
  Start keeping everything. ← gradient text, italic
  ```
- Subheadline (DM Sans 16px, muted):
  "Generate a QR. Customer pays with **any UPI app**. AI verifies in seconds. Money lands in **your bank** — not ours."
- CTA row: "Start building →" (dark fill) + "See the live demo" (outline)
- npm hint: `or run npm i upiagent` (monospace, very faint)

**Animations (on load)**:
1. Pill fades in (0ms, 400ms duration)
2. Headline words stagger in from below (200ms start, 60ms per word)
3. Red strikethrough animates left→right (400ms delay, 700ms duration, cubic-bezier)
4. Gradient text shimmer begins (continuous)
5. Sub + CTAs fade up (600ms delay, spring physics)

### Section 2: Product Flow
**Layout**: Full-width container (1100px), mesh gradient backdrop

**Content**: Animated 4-step flow diagram showing the product in action:
```
[1. QR Code card] → [2. Phone + UPI apps] → [3. Gmail alert] → [4. AI ✓ Verified]
```

Each step is a clean card/icon sitting ON the mesh gradient. Connected by animated lines/arrows that draw between them.

**Key design rule**: This replaces the empty gradient decoration. The gradient is a backdrop for meaningful product content, not filler.

**Animations (scroll-triggered, `whileInView`)**:
1. Gradient orbs begin floating animation when section enters viewport
2. Step 1 card fades in + scales up (0ms)
3. Connecting line draws from step 1 → 2 (300ms)
4. Step 2 fades in (600ms)
5. Line draws 2 → 3 (900ms)
6. Step 3 fades in (1200ms)
7. Line draws 3 → 4 (1500ms)
8. Step 4 fades in with green glow pulse (1800ms) — the "verified" moment

**Parallax**: Gradient orbs move at 0.3x, 0.5x, 0.7x scroll speed

### Section 3: Trust + Stats
**Layout**: Centered, two rows

**Row 1 — Trust bar**:
- Label: "WORKS WITH EVERY UPI APP"
- Logos (text for now, real SVG logos later): Google Pay, PhonePe, Paytm, CRED, BHIM, Amazon Pay

**Row 2 — Stats** (3 columns, border-top separator):
- 0% (gradient) — Transaction fees
- ~$0.001 — Per verification
- <10s — Verification time

**Animations**:
- Trust logos fade in with stagger (50ms each)
- Stat numbers count up from 0 when entering viewport (1.5s duration, ease-out)

### Section 4: How It Works (detailed)
**Layout**: Section label + h2 + 4-column card grid

**Header**:
- Label: "HOW IT WORKS"
- Headline: "Four steps. *No middleman.*" (italic gradient on "No middleman")

**Cards** (each with step number, title, description):
1. **Generate QR** — Create a UPI intent QR with amount and your VPA. Works with any bank.
2. **Customer pays** — Scan with GPay, PhonePe, Paytm. Money goes directly to your bank.
3. **Connect Gmail** — Bank sends confirmation email. upiagent reads it automatically via OAuth.
4. **AI verifies** — LLM parses the email. Matches amount, time, dedup. Payment confirmed.

**Animations**:
- Cards stagger in left→right, 100ms delay between each
- On hover: subtle lift (translateY -2px) + shadow increase

### Section 5: Live Demo (layered)
**Layout**: Two states — cinematic story (default) + expandable real demo

**State 1 — Cinematic story** (always visible):
A polished animated sequence showing a transaction happening:
- Left: Styled QR code with amount (₹4,999)
- Center: Animated arrow/flow showing payment moving
- Right: Terminal-style card showing verification steps appearing one by one
- Below the visual: One line — "This is real. Not a mockup." + CTA "Try it live →"

**State 2 — Expandable real demo** (on CTA click):
- Layout animation expands to reveal the actual working LiveDemo component
- Real QR code generation, real verification polling
- Collapsible config panel for UPI VPA / amount

**Animations**:
- Cinematic sequence plays on scroll enter (whileInView)
- "Try it live" CTA triggers layout expand (Motion layout animation, 500ms spring)
- Real demo slides in with opacity + height transition

### Section 6: Quick Start + Security
**Layout**: Two-column split

**Left — Quick Start**:
- Label: "FOR DEVELOPERS"
- Code block with terminal card styling:
  ```bash
  npm install upiagent
  ```
  ```typescript
  import { UPIAgent } from 'upiagent'

  const agent = new UPIAgent({
    vpa: 'merchant@upi',
    geminiKey: process.env.GEMINI_KEY,
  })

  const { qrCode, txnId } = await agent.generateQR({
    amount: 499,
    note: 'Order #1234'
  })

  const result = await agent.verifyPayment(txnId)
  // result.verified === true
  ```

**Right — Security**:
- Label: "4-LAYER VERIFICATION"
- Stacked cards showing each security layer:
  1. Format validation — Is this a real bank email?
  2. Amount match — Does ₹ match the expected amount?
  3. Time window — Was it received within the expected window?
  4. Dedup check — Has this transaction ID been seen before?

**Animations**:
- Code block: typewriter effect, lines appear one by one (left)
- Security cards: fan-out / stack animation on scroll — cards spread apart as user scrolls in (right)

### Section 7: Pricing + Final CTA
**Layout**: Pricing comparison + full-width CTA

**Pricing** (simple table or 3 cards):
| Model | Cost per verification | Speed |
|-------|----------------------|-------|
| Gemini Flash (free tier) | ~$0.0001 | ~3s |
| GPT-4o-mini | ~$0.001 | ~4s |
| Claude Sonnet | ~$0.003 | ~5s |

Note: "Default is Gemini (free tier). Bring your own key for any model."

**Final CTA**:
- Full-width section with gradient background (subtle mesh, intensifies on scroll)
- Headline: "Start accepting payments today."
- Sub: "No sign-up. No approval. No fees. Just npm install."
- CTA: "Get started free →" + "Star on GitHub"

**Animations**:
- Pricing cards scale up from 0.95 on enter
- Final CTA gradient intensifies (opacity 0.5 → 1) as user scrolls into it
- CTA button has spring hover animation

---

## 5. Motion & Animation Spec

### Library: Motion (framer-motion)
- Use `motion/react-client` wrapper for Next.js App Router
- LazyMotion + domAnimation for bundle optimization (~4.6KB)

### Global animation patterns:
| Pattern | Implementation | Trigger |
|---------|---------------|---------|
| Fade up | `initial={{ opacity: 0, y: 30 }}` `animate={{ opacity: 1, y: 0 }}` | `whileInView`, `viewport={{ once: true }}` |
| Stagger children | `transition={{ staggerChildren: 0.1 }}` on parent | Parent enters viewport |
| Spring physics | `transition={{ type: "spring", stiffness: 100, damping: 15 }}` | All major reveals |
| Parallax | `useScroll()` + `useTransform(scrollY, [start, end], [0, -distance])` | Continuous scroll |
| Count up | Custom hook with `useMotionValue` + `useTransform` | `whileInView` |
| Line draw | SVG path with `pathLength` animation `0 → 1` | `whileInView` |
| Layout expand | `layout` prop + `AnimatePresence` | User click |

### Performance rules:
- `viewport={{ once: true }}` on all scroll reveals — animate once, don't re-trigger
- `will-change: transform` on parallax elements
- `prefers-reduced-motion` respected via `MotionConfig reducedMotion="user"`
- No Tailwind `transition-*` classes on motion elements (conflict)
- Virtualize if any list exceeds 20 items

---

## 6. Technical Architecture

### Stack (existing, no changes):
- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- Geist fonts → **replace with** Instrument Serif + DM Sans + JetBrains Mono (via next/font/google)

### New dependency:
- `motion` (framer-motion) — for all scroll animations, parallax, layout transitions

### File structure changes:
```
apps/www/src/
├── app/
│   ├── layout.tsx          ← update fonts, add MotionConfig provider
│   ├── page.tsx            ← rewrite: compose sections
│   └── globals.css         ← rewrite: new design tokens, remove old animations
├── components/
│   ├── motion-client.tsx   ← NEW: "use client" motion wrapper
│   ├── nav.tsx             ← NEW: sticky nav with backdrop blur
│   ├── hero.tsx            ← NEW: hero section with load animations
│   ├── product-flow.tsx    ← NEW: 4-step animated flow on gradient
│   ├── trust-stats.tsx     ← NEW: trust bar + stats with count-up
│   ├── how-it-works.tsx    ← NEW: detailed 4-step cards
│   ├── live-demo-section.tsx ← NEW: cinematic + expandable real demo
│   ├── quick-start.tsx     ← NEW: code block + security layers
│   ├── pricing-cta.tsx     ← NEW: pricing table + final CTA
│   ├── animated-flow.tsx   ← DELETE (replaced by product-flow.tsx)
│   ├── hero-canvas.tsx     ← DELETE (replaced by gradient + motion)
│   ├── terminal.tsx        ← KEEP (used inside live demo)
│   ├── live-demo.tsx       ← KEEP (wrapped by live-demo-section.tsx)
│   ├── code-block.tsx      ← KEEP (used in quick-start)
│   └── security-layer.tsx  ← KEEP (used in quick-start)
```

### Responsive breakpoints:
- Mobile: < 640px (single column, smaller type, no parallax)
- Tablet: 640-1024px (2-column where applicable)
- Desktop: 1024px+ (full layout)

### Accessibility:
- `MotionConfig reducedMotion="user"` at layout root
- Proper heading hierarchy (h1 → h2 → h3)
- All interactive elements focusable
- Color contrast 4.5:1 minimum
- Skip-to-content link

---

## 7. Content & Copy

### Tone: Rebellious but clean
- Direct, short sentences
- Indian English is fine (₹, UPI, VPA are domain terms)
- "Your bank" not "your account"
- Contractions OK ("don't", "that's")
- No corporate fluff ("leverage", "seamless", "cutting-edge")

### Key phrases locked:
- "Stop paying gateway fees. Start keeping everything."
- "Four steps. No middleman."
- "This is real. Not a mockup."
- "No sign-up. No approval. No fees. Just npm install."

---

## 8. Out of Scope

- Dark mode toggle (this is a light-mode brand page)
- Blog / docs pages (separate concern)
- Dashboard redesign (separate app)
- SEO/meta tags (keep existing, update copy)
- Analytics integration (keep existing)
- i18n (English only)

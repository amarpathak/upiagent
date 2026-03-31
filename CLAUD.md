# CLAUDE.md — upiagent

## 🎯 Project Purpose

**upiagent** is an npm package that enables UPI payment verification via Gmail bank alert parsing — without needing a payment gateway. It uses LLM-based parsing with a multi-layer security architecture.

**CRITICAL CONTEXT: This is a learning project.** The developer (Amar) is building this to learn LangChain, LLM integration patterns, API design, and production Node.js/TypeScript. Every task should be treated as a teaching opportunity.

---

## 👤 Developer Context

- **Name:** Amar
- **Strength:** Senior Frontend Engineer — 7+ years React/Next.js/TypeScript
- **Learning:** LangChain, LLM integration, Python (comfortable but not expert), production AI patterns
- **Goal:** Build FDE (Forward Deployed Engineer) portfolio. This project demonstrates: LLM-powered parsing, security architecture, npm package design, real-world AI utility
- **Style:** Learns best by building. Prefers understanding WHY before HOW. Wants to own every line of code.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   upiagent                       │
│                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│  │  Gmail    │──▶│  LLM     │──▶│ Security │    │
│  │  Adapter  │   │  Parser  │   │  Layers  │    │
│  └──────────┘   └──────────┘   └──────────┘    │
│       │              │              │            │
│  Fetches bank   Extracts:      4-Layer:         │
│  alert emails   - Amount       1. Format check  │
│  via Gmail API  - UPI ref      2. Amount match   │
│                 - Sender       3. Time window    │
│                 - Timestamp    4. Duplicate check │
│                 - Status                         │
└─────────────────────────────────────────────────┘
```

---

## 📚 Teaching Rules for Claude Code

### ALWAYS do this:

1. **Explain before writing code.** Before implementing anything, explain:
   - WHAT we're building in this step
   - WHY this pattern/approach (not just "best practice" — explain the actual reason)
   - HOW it connects to the bigger picture
   - What ALTERNATIVES exist and why we chose this one

2. **Build incrementally.** Never generate the full project at once. Follow the brick-by-brick phases below. Each phase should be a working, testable unit.

3. **Comment with learning notes.** Add inline comments that teach, not just describe:
   ```typescript
   // BAD: "Parse the email"
   // GOOD: "We use structured output parsing here instead of regex because bank email
   //        formats vary across banks (HDFC vs SBI vs ICICI). LLM handles this variance
   //        naturally. This is a core FDE pattern — using AI where rule-based systems
   //        become unmaintainable."
   ```

4. **Show the decision tree.** When making architectural choices, present options:
   ```
   Option A: Use OpenAI function calling → more structured, costs more
   Option B: Use prompt + JSON parsing → cheaper, less reliable
   Option C: Use LangChain structured output → best of both, adds dependency
   → We're going with C because [reason]. Here's how it works...
   ```

5. **Test as you build.** Every phase ends with a working test. Not just unit tests — show Amar how to manually verify each piece works.

6. **Connect to FDE concepts.** When relevant, note:
   - "This is a production pattern you'd use in FDE work"
   - "In a client deployment, you'd also need to consider..."
   - "This is what LangSmith would help you trace in production"

### NEVER do this:

- Don't generate boilerplate silently — explain what each config file does
- Don't use patterns without explaining tradeoffs
- Don't skip error handling — security is a core feature of this package
- Don't abstract too early — let Amar see the raw version before refactoring
- Don't assume knowledge of Gmail API, LangChain, or npm publishing — explain each

---

## 🧱 Build Phases (Brick by Brick)

### Phase 0: Project Scaffold
**Learn:** TypeScript project setup, npm package structure, tsconfig for libraries
- Init project with `pnpm init`
- TypeScript config (explain `declaration`, `moduleResolution`, `target` choices)
- ESLint + Prettier (minimal, not over-configured)
- Package.json — `main`, `types`, `exports` fields for npm packages
- `.gitignore`, `README.md` scaffold
- **Checkpoint:** `pnpm build` works, produces `.d.ts` files

### Phase 1: Gmail Adapter
**Learn:** OAuth2, Gmail API, working with Google Cloud Console
- Google Cloud project setup (explain OAuth2 flow for Gmail)
- Gmail API client — authenticate, fetch emails
- Email filtering — search query for bank alerts (`from:alerts@hdfcbank.net` etc.)
- Raw email parsing — extract subject + body from MIME format
- **Checkpoint:** Can fetch last 5 bank alert emails and print subject + body

### Phase 2: LLM Parser (Core Learning)
**Learn:** LangChain basics, structured output, prompt engineering
- Install LangChain (`@langchain/core`, `@langchain/openai` or `@langchain/anthropic`)
- Understand the chain: prompt template → LLM → output parser
- Design the extraction schema (Zod schema for parsed payment data):
  ```typescript
  {
    amount: number
    upiReferenceId: string
    senderName: string
    senderUpiId: string
    bankName: string
    timestamp: Date
    status: 'success' | 'failed' | 'pending'
    rawSubject: string
  }
  ```
- Build the prompt — show multiple bank email formats, explain few-shot prompting
- Implement structured output parsing with LangChain
- Handle edge cases: partial data, non-payment emails, different languages
- **Checkpoint:** Feed a bank alert email string → get structured JSON back

### Phase 3: Security Layer
**Learn:** Defense-in-depth, input validation, idempotency
- **Layer 1 — Format Validation:** Zod schema validation on LLM output. If LLM hallucinates, catch it here.
- **Layer 2 — Amount Matching:** Compare parsed amount against expected amount (within tolerance). Explain why fuzzy matching is dangerous here.
- **Layer 3 — Time Window:** Payment must be within configurable time window (default: 30 mins). Explain replay attack prevention.
- **Layer 4 — Duplicate Detection:** Track processed UPI reference IDs. Explain idempotency and why it matters for payments.
- **Checkpoint:** Write tests that try to break each layer

### Phase 4: Main API Design
**Learn:** API design for npm packages, TypeScript generics, builder pattern
- Design the public API:
  ```typescript
  const agent = new UpiAgent({
    gmail: { credentials: '...' },
    llm: { provider: 'openai', apiKey: '...' },
    security: { timeWindowMinutes: 30, amountTolerancePercent: 0 }
  })

  const result = await agent.verifyPayment({
    expectedAmount: 499,
    expectedFrom: 'user@upi',  // optional
    lookbackMinutes: 30
  })
  // → { verified: true, payment: {...}, confidence: 0.95 }
  ```
- Implement the orchestrator that ties Gmail → LLM → Security together
- Error handling strategy — custom error classes, never expose internals
- **Checkpoint:** Full end-to-end flow works with real Gmail

### Phase 5: Production Hardening
**Learn:** Logging, retry logic, cost control, rate limiting
- Structured logging (explain why `console.log` isn't enough)
- LLM retry logic with exponential backoff
- Token usage tracking (explain LLM cost awareness — FDE must-know)
- Rate limiting on Gmail API calls
- Configuration validation on init
- **Checkpoint:** Handles network failures, API rate limits, malformed emails gracefully

### Phase 6: Testing & Documentation
**Learn:** Testing strategies for AI systems, npm publishing
- Unit tests for each security layer
- Integration test with mock Gmail + mock LLM responses
- Testing LLM outputs — explain non-determinism and how to handle it
- Write README with:
  - Clear installation instructions
  - Quick start code
  - Architecture diagram
  - Security model explanation
  - API reference
- **Checkpoint:** `pnpm test` passes, README is portfolio-ready

### Phase 7: npm Publish & GitHub Polish
**Learn:** npm publishing, semantic versioning, GitHub best practices
- `npm publish` workflow
- GitHub Actions CI (lint → test → build → publish)
- Changelog and versioning
- GitHub README badges
- **Checkpoint:** Package is live on npm, GitHub repo is portfolio-ready

---

## 🔧 Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript 5.x (strict mode)
- **Package Manager:** pnpm
- **LLM:** LangChain.js (`@langchain/core` + provider of choice)
- **Gmail:** `googleapis` (official Google API client)
- **Validation:** Zod
- **Testing:** Vitest
- **Build:** tsup (simple, fast TypeScript bundler)
- **Linting:** ESLint + Prettier

---

## 📁 Project Structure

```
upiagent/
├── CLAUDE.md              ← You are here
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── .env.example
├── .gitignore
├── README.md
├── src/
│   ├── index.ts           ← Public API exports
│   ├── agent.ts           ← Main UpiAgent class (orchestrator)
│   ├── gmail/
│   │   ├── client.ts      ← Gmail API wrapper
│   │   ├── parser.ts      ← Raw email → clean text
│   │   └── types.ts
│   ├── llm/
│   │   ├── chain.ts       ← LangChain parsing chain
│   │   ├── prompts.ts     ← Prompt templates
│   │   ├── schema.ts      ← Zod schemas for structured output
│   │   └── types.ts
│   ├── security/
│   │   ├── validator.ts   ← 4-layer security pipeline
│   │   ├── dedup.ts       ← Duplicate detection
│   │   └── types.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── retry.ts
│   │   └── errors.ts
│   └── types.ts           ← Shared types
├── tests/
│   ├── gmail.test.ts
│   ├── llm.test.ts
│   ├── security.test.ts
│   └── agent.test.ts
└── examples/
    ├── basic-usage.ts
    └── with-next-api.ts   ← Example: Next.js API route integration
```

---

## 🎓 Learning Connections

| upiagent Concept | FDE Skill It Teaches |
|---|---|
| LLM structured output | LangChain core — used in every AI deployment |
| 4-layer security | Defense-in-depth — enterprise clients demand this |
| Gmail API OAuth2 | Real-world API integration — messy auth flows |
| npm package design | Shipping reusable tools — FDE deliverable pattern |
| Error handling + retries | Production resilience — what separates demos from deployments |
| Cost tracking | LLM cost awareness — FDE must justify spend to clients |
| Zod validation | Schema-first design — catches hallucinations before they escape |
| Testing non-deterministic AI | Eval mindset — "how do you know it works?" |

---

## 🚀 Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Watch mode (tsup)
pnpm build            # Production build
pnpm test             # Run tests
pnpm lint             # Lint + type check
pnpm publish:dry      # Dry run npm publish
```

---

## 📌 Current Phase

**Phase 0 — Project Scaffold**
Status: Not started
Next action: Initialize project, set up TypeScript config

---

## ⚠️ Reminders

- Always use `strict: true` in tsconfig
- Never log sensitive data (OAuth tokens, API keys, email content in production)
- LLM calls are expensive — cache when possible, track token usage
- Gmail API has rate limits (250 quota units per user per second)
- UPI reference IDs are 12-digit numbers — validate format
- Bank email formats change without notice — this is WHY we use LLM instead of regex
- This package handles financial verification — security is not optional, it's the core feature

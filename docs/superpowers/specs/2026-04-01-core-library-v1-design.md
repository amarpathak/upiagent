# @upiagent/core v1 — Library Refactor Design Spec

**Date:** 2026-04-01
**Goal:** Eliminate all duplication between apps and core, make core the single source of truth for verification, harden security, ship production-ready adapters, and prepare for open-source release.

---

## 1. Unified `verifyPayment()` API

Replace `UpiAgent` class with a single functional entry point.

```typescript
const result = await verifyPayment(email, {
  llm: { provider: 'gemini', model: 'gemini-2.0-flash', apiKey: '...' },
  expected: { amount: 499.37, timeWindowMinutes: 30 },
  dedup: postgresDedupStore,
  rateLimiter: llmRateLimiter,
  preset: 'demo', // optional
});
```

### Options

- `llm` — required. Provider, model (no defaults — `ConfigError` if omitted), API key.
- `expected` — required. Amount to match, time window.
- `dedup` — optional. Any `DedupStore` implementation. Defaults to `InMemoryDedupStore`.
- `rateLimiter` — optional. `LlmRateLimiter` instance. No default (no limiting).
- `preset` — optional. `'demo'` preset:
  - Relaxes confidence threshold to 0.4 (vs 0.5)
  - Uses in-memory dedup
  - Redacts all PII from returned result:
    - Sender name: `"S***r"`
    - UPI ID: `"***@ybl"`
    - UPI ref ID: last 4 digits only (`"********8901"`)
    - Email body: never included in result
  - Same prompts, same LLM chain, same security layers — config differences only

### Delete

- `UpiAgent` class (`src/agent.ts`) — removed entirely, not deprecated. Pre-launch, no backwards compat needed.
- `UpiAgentConfig` type — removed.

---

## 2. Pluggable Adapters

### PostgresDedupStore

New file: `src/security/dedup-postgres.ts`

```typescript
export class PostgresDedupStore implements DedupStore {
  constructor(pool: pg.Pool, tableName?: string)  // default: 'payment_dedup'
  has(refId: string): Promise<boolean>
  add(refId: string, ttlMinutes: number): Promise<void>
}
```

- Accepts standard `pg.Pool` — works with Supabase, Neon, raw Postgres.
- `pg` is a **peer dependency** (optional). Core works without it via `InMemoryDedupStore`.
- Ships a `.sql` migration file in the package for the `payment_dedup` table.
- Graceful fallback: if table doesn't exist, logs error, does not crash.

### LLM Rate Limiter

New file: `src/utils/rate-limiter.ts`

```typescript
export class LlmRateLimiter {
  constructor(opts: { maxCallsPerMinute: number, maxCallsPerHour?: number })
  async acquire(key?: string): Promise<void>  // throws LlmRateLimitError if exceeded
}
```

- In-memory sliding window counter.
- Per-key optional (e.g., per-merchant).
- Protects against runaway LLM loops. Apps handle their own HTTP rate limiting.
- Zero external dependencies.

---

## 3. Cost Tracking — Wired Up

Current state: `CostTracker` exists but is dead code. LangChain's `withStructuredOutput()` doesn't expose token counts automatically.

Fix: Add `CostTracker.asLangChainHandler()` method that returns a `BaseCallbackHandler` hooking into `handleLLMEnd` to capture `tokenUsage` from response metadata.

```typescript
// In chain.ts — accept callback handlers
const chain = createPaymentExtractionChain(config, {
  callbacks: [costTracker.asLangChainHandler()]
});
```

Consumers pass a `CostTracker` instance via `verifyPayment()` options (optional). If not provided, no tracking overhead.

---

## 4. Security Hardening

### Bank Email Whitelist + Tiered Confidence

New file: `src/security/bank-registry.ts`

```typescript
export interface BankPattern {
  name: string;
  senderPatterns: string[];    // email addresses
  bodyPatterns: RegExp[];      // credit notification regex
}

// Ships with ~15 built-in Indian banks (HDFC, SBI, ICICI, Kotak, PhonePe, GPay, Paytm, etc.)
const BUILTIN_BANKS: BankPattern[];

// Public API — OSS contributors add banks via PRs or runtime registration
export function registerBankPattern(pattern: BankPattern): void;
export function isKnownBankEmail(fromAddress: string): { known: boolean; bankName?: string };
```

### New Security Layer (1.5)

Inserted between format validation and amount matching:

1. **Layer 1:** Format validation (existing — `isPaymentEmail`, confidence >= 0.5)
2. **Layer 1.5 (new): Bank source validation**
   - Known bank sender -> proceed normally (confidence threshold 0.5)
   - Unknown sender -> raise confidence threshold to 0.8
   - Log unknown senders for observability
3. **Layer 2:** Amount matching (existing)
4. **Layer 3:** Time window (existing)
5. **Layer 4:** Dedup (existing)

### Pre-LLM Content Check

Before sending email to LLM, check if body contains any currency-related pattern (`Rs`, `INR`, `credited`, `received`, currency symbols). If none found, reject immediately — saves tokens and blocks non-payment injection attempts.

### Prompt Injection Hardening

Add missing patterns to `src/llm/prompts.ts`:
- `disregard my instructions`
- `disregard\s+all`
- Unicode homoglyphs for common injection words (e.g., Cyrillic "о" in "ignore")
- Expand existing regex coverage

---

## 5. Standalone QR Generation

`createPayment()` already works standalone — no agent/LLM config needed. The fix is making apps use it.

`apps/www/api/demo/route.ts` currently reimplements QR generation from scratch. Replace with:

```typescript
import { createPayment } from '@upiagent/core';

const payment = createPayment({
  merchant: { upiId, name: merchantName },
  amount,
  note,
});
// Returns: { qrDataUrl, intentUrl, amount, transactionId }
```

---

## 6. Model Defaults Removed

Current: hardcoded defaults like `"gpt-4o-mini"`, `"claude-sonnet-4-5-20250514"`.

After: `provider` and `model` are both **required** in `LlmConfig`. Omitting either throws `ConfigError` with a helpful message listing supported providers and example model strings.

No opinions baked into the library about which model to use.

---

## 7. App Migration

### `apps/dashboard/src/app/api/verify/route.ts`

- Drop all manual LLM/Gmail/dedup orchestration (~200 lines)
- Call `verifyPayment()` with `PostgresDedupStore` backed by Supabase pool
- Pass `LlmRateLimiter` from app config
- Keep HTTP auth + request validation (app concern)

### `apps/www/src/app/api/verify/route.ts`

- Drop raw Gemini API call and hand-built prompt entirely
- Call `verifyPayment()` with `preset: 'demo'`
- PII redaction handled by core — no sensitive data leaks
- Keep HTTP rate limiting (app concern)

### `apps/www/src/app/api/demo/route.ts`

- Replace manual QR generation with `createPayment()` from core

**Estimated reduction:** ~400 lines of duplicated logic removed across apps.

---

## 8. File Changes

| Action | File | Description |
|--------|------|-------------|
| **New** | `src/verify.ts` | Unified `verifyPayment()` entry point |
| **New** | `src/security/bank-registry.ts` | Bank whitelist + pattern registration |
| **New** | `src/security/dedup-postgres.ts` | Postgres dedup adapter |
| **New** | `src/utils/rate-limiter.ts` | LLM call rate limiter |
| **New** | `migrations/payment_dedup.sql` | SQL for dedup table |
| **Modify** | `src/llm/chain.ts` | Accept callback handlers for cost tracking |
| **Modify** | `src/llm/prompts.ts` | Add missing injection patterns, pre-LLM content check |
| **Modify** | `src/security/validator.ts` | Add bank source validation layer (1.5) |
| **Modify** | `src/utils/cost.ts` | Add `asLangChainHandler()` method |
| **Modify** | `src/index.ts` | New exports, remove UpiAgent |
| **Modify** | `apps/dashboard/api/verify/route.ts` | Use `verifyPayment()` |
| **Modify** | `apps/www/api/verify/route.ts` | Use `verifyPayment()` with demo preset |
| **Modify** | `apps/www/api/demo/route.ts` | Use `createPayment()` from core |
| **Delete** | `src/agent.ts` | UpiAgent class removed |

---

## 9. New Exports

```typescript
// Primary API
export { verifyPayment, VerifyPaymentOptions, VerificationPreset } from './verify';

// Adapters
export { PostgresDedupStore } from './security/dedup-postgres';
export { LlmRateLimiter } from './utils/rate-limiter';

// Bank registry (extensible by OSS community)
export { registerBankPattern, isKnownBankEmail, BankPattern } from './security/bank-registry';

// Everything else stays (payment, gmail, security, llm, utils, crypto)
// Minus: UpiAgent, UpiAgentConfig (deleted)
```

---

## 10. New Dependency

- `pg` — **peer dependency**, optional. Only required for `PostgresDedupStore`.

---

## 11. Non-Goals

- No multi-currency support (UPI is INR-only).
- No non-Gmail verification channels (future work).
- No HTTP-level rate limiting (app responsibility).
- No LangChain replacement (future consideration).
- No test framework migration (stay on Vitest).
- New code gets unit tests; existing test patterns are followed.

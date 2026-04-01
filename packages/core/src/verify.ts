/**
 * Unified Payment Verification API
 *
 * This is the primary API for @upiagent/core v1. It provides two functions:
 *
 * 1. verifyPayment(email, options) — verify a single email message
 * 2. fetchAndVerifyPayment(options) — fetch from Gmail + verify in a loop
 *
 * Both functions return a VerificationResult with detailed layer-by-layer
 * pass/fail information for debugging and transparency.
 */

import type { EmailMessage, GmailCredentials } from "./gmail/types.js";
import type { LlmConfig } from "./llm/types.js";
import type { ParsedPayment } from "./llm/schema.js";
import type {
  DedupStore,
  VerificationResult,
  SecurityConfig,
} from "./security/types.js";
import { parsePaymentEmail } from "./llm/chain.js";
import { SecurityValidator } from "./security/validator.js";
import { InMemoryDedupStore } from "./security/dedup.js";
import { shouldSkipLlm } from "./security/bank-registry.js";
import { CostTracker } from "./utils/cost.js";
import { LlmRateLimiter } from "./utils/rate-limiter.js";
import { LlmRateLimitError } from "./utils/errors.js";
import { GmailClient } from "./gmail/client.js";

// ── Types ────────────────────────────────────────────────────────────

export type VerificationPreset = "demo";

export interface VerifyPaymentOptions {
  llm: LlmConfig;
  expected: {
    amount: number;
    timeWindowMinutes?: number;
    amountTolerancePercent?: number;
  };
  dedup?: DedupStore;
  rateLimiter?: LlmRateLimiter;
  costTracker?: CostTracker;
  preset?: VerificationPreset;
}

export interface FetchAndVerifyOptions extends VerifyPaymentOptions {
  gmail: GmailCredentials;
  lookbackMinutes?: number;
  maxEmails?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Creates an unverified VerificationResult with no payment data.
 * Used for early-exit cases (pre-LLM gate, rate limit, LLM null).
 */
function unverifiedResult(
  failureReason: VerificationResult["failureReason"],
  failureDetails?: string,
): VerificationResult {
  return {
    verified: false,
    payment: null,
    confidence: 0,
    failureReason,
    failureDetails,
    layerResults: [],
  };
}

/**
 * Redact PII fields for demo preset.
 *
 * - senderName: "John Doe" -> "J***e"
 * - senderUpiId: "john@ybl" -> "***@ybl"
 * - upiReferenceId: "412345678901" -> "********8901"
 * - rawSubject: "***"
 */
function redactPii(payment: ParsedPayment): ParsedPayment {
  const name = payment.senderName;
  const redactedName =
    name.length >= 2
      ? `${name[0]}***${name[name.length - 1]}`
      : "***";

  const upiId = payment.senderUpiId;
  const atIndex = upiId.indexOf("@");
  const redactedUpiId =
    atIndex >= 0
      ? `***${upiId.slice(atIndex)}`
      : "***";

  const refId = payment.upiReferenceId;
  const last4 = refId.length > 4 ? refId.slice(-4) : refId;
  const stars = "*".repeat(Math.max(0, refId.length - 4));
  const redactedRefId = `${stars}${last4}`;

  return {
    ...payment,
    senderName: redactedName,
    senderUpiId: redactedUpiId,
    upiReferenceId: redactedRefId,
    rawSubject: "***",
  };
}

// ── Main API ─────────────────────────────────────────────────────────

/**
 * Verify a single email message against expected payment details.
 *
 * Pipeline:
 * 1. Pre-LLM gate (shouldSkipLlm)
 * 2. Rate limiter check
 * 3. LLM parsing
 * 4. Security validation (format, bank source, amount, time, dedup)
 * 5. Demo redaction (if preset === "demo")
 */
export async function verifyPayment(
  email: EmailMessage,
  options: VerifyPaymentOptions,
): Promise<VerificationResult> {
  // ── Step 1: Pre-LLM gate ──────────────────────────────────────
  if (shouldSkipLlm(email.from, email.body)) {
    return unverifiedResult("NOT_PAYMENT_EMAIL", "Email does not appear to be a payment notification");
  }

  // ── Step 2: Rate limiter ──────────────────────────────────────
  if (options.rateLimiter) {
    try {
      await options.rateLimiter.acquire();
    } catch (err) {
      if (err instanceof LlmRateLimitError) {
        return unverifiedResult(
          "NOT_PAYMENT_EMAIL",
          `LLM rate limit exceeded — ${err.message}`,
        );
      }
      throw err;
    }
  }

  // ── Step 3: LLM parsing ───────────────────────────────────────
  const callbacks = options.costTracker
    ? { callbacks: [{ handleLLMEnd: options.costTracker.handleLLMEnd.bind(options.costTracker) }] }
    : undefined;

  const parsed = await parsePaymentEmail(email, options.llm, callbacks);

  if (!parsed) {
    return unverifiedResult("NOT_PAYMENT_EMAIL", "LLM could not parse payment data from email");
  }

  // ── Step 4: Security validation ───────────────────────────────
  const securityConfig: SecurityConfig = {
    timeWindowMinutes: options.expected.timeWindowMinutes,
    amountTolerancePercent: options.expected.amountTolerancePercent,
  };

  const validator = new SecurityValidator(securityConfig, options.dedup);

  const result = await validator.validate(
    parsed,
    {
      expectedAmount: options.expected.amount,
      lookbackMinutes: options.expected.timeWindowMinutes,
    },
    email.receivedAt,
    { from: email.from },
  );

  // ── Step 5: Demo redaction ────────────────────────────────────
  if (options.preset === "demo" && result.payment) {
    return {
      ...result,
      payment: redactPii(result.payment),
    };
  }

  return result;
}

/**
 * Fetch emails from Gmail and verify each one until a match is found.
 *
 * 1. Create GmailClient with provided credentials
 * 2. Fetch bank alert emails within lookback window
 * 3. Loop through emails, calling verifyPayment() for each
 * 4. Return first verified match, or last unverified result
 * 5. If no emails found, return unverified with appropriate message
 */
export async function fetchAndVerifyPayment(
  options: FetchAndVerifyOptions,
): Promise<VerificationResult> {
  const client = new GmailClient(options.gmail);

  const emails = await client.fetchBankAlerts({
    lookbackMinutes: options.lookbackMinutes ?? 30,
    maxResults: options.maxEmails ?? 10,
  });

  if (emails.length === 0) {
    return unverifiedResult(
      "NOT_PAYMENT_EMAIL",
      "No bank alert emails found in the specified time window",
    );
  }

  let lastResult: VerificationResult | null = null;

  for (const email of emails) {
    const result = await verifyPayment(email, options);

    if (result.verified) {
      return result;
    }

    lastResult = result;
  }

  // No verified match found — return the last unverified result
  return lastResult!;
}

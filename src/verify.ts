/**
 * Unified Payment Verification API
 *
 * This is the primary API for upiagent v1. It provides two functions:
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
  VerificationResult,
  SecurityConfig,
} from "./security/types.js";
import type { DedupStore } from "./security/dedup.js";
import { parsePaymentEmail } from "./llm/chain.js";
import { SecurityValidator } from "./security/validator.js";
import { shouldSkipLlm, isKnownBankEmail, getBankDisplayName } from "./security/bank-registry.js";
import { CostTracker } from "./utils/cost.js";
import { LlmRateLimiter } from "./utils/rate-limiter.js";
import { LlmRateLimitError } from "./utils/errors.js";
import { GmailClient } from "./gmail/client.js";
import { StepLogger } from "./utils/step-logger.js";
import type { EmailClassification, EmailClassifier } from "./classifier/types.js";

// ── Types ────────────────────────────────────────────────────────────

export type VerificationPreset = "demo";

export interface VerifyPaymentOptions {
  llm: LlmConfig;
  expected: {
    amount: number;
    timeWindowMinutes?: number;
    amountTolerancePercent?: number;
  };
  /** UTR hints from pre-registration. If the bank email's UTR matches any of these,
   *  the amount layer is skipped (UTR is a stronger identifier than amount). */
  expectedUtrs?: string[];
  dedup?: DedupStore;
  rateLimiter?: LlmRateLimiter;
  /** Bucket for `rateLimiter` (e.g. a merchant ID). Defaults to one global bucket. */
  rateLimitKey?: string;
  costTracker?: CostTracker;
  stepLogger?: StepLogger;
  preset?: VerificationPreset;
  /**
   * Optional pre-screen (e.g. JevClassifier) run after the free regex gate and
   * before the extraction LLM. Failures fall through to the LLM — the gate may
   * save spend but must never lose a real payment.
   */
  classifier?: EmailClassifier;
  /** Skip extraction when the classifier's P(credit) is below this. Default 0.15. */
  minCreditProbability?: number;
}

/** Options that depend only on the email — shared across every pending payment. */
export type ExtractPaymentOptions = Pick<
  VerifyPaymentOptions,
  "llm" | "rateLimiter" | "rateLimitKey" | "costTracker" | "stepLogger" | "classifier" | "minCreditProbability"
>;

/** Options that depend on the payment being matched. */
export type MatchPaymentOptions = Pick<
  VerifyPaymentOptions,
  "expected" | "expectedUtrs" | "dedup" | "stepLogger" | "preset"
>;

export type ExtractionResult =
  | { status: "extracted"; payment: ParsedPayment; classification?: EmailClassification }
  | { status: "skipped"; result: VerificationResult; classification?: EmailClassification };

export interface FetchAndVerifyOptions extends VerifyPaymentOptions {
  gmail: GmailCredentials;
  /** Merchant-specific bank sender emails (merged with built-in list) */
  customBankSenders?: string[];
  lookbackMinutes?: number;
  maxEmails?: number;
  /** Gmail message IDs already parsed by previous polls — skip to save LLM tokens */
  skipMessageIds?: Set<string>;
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

const DEFAULT_MIN_CREDIT_PROBABILITY = 0.15;
const SUSPICION_THRESHOLD = 0.8;

/**
 * Stage 1 — everything that depends only on the email: the free regex gate,
 * the optional classifier, the rate limiter, the extraction LLM and the
 * post-extraction checks. Run it once per email, then match the result
 * against as many pending payments as needed with `matchParsedPayment`.
 */
export async function extractPayment(
  email: EmailMessage,
  options: ExtractPaymentOptions,
): Promise<ExtractionResult> {
  const log = options.stepLogger;

  // ── Step 1: Pre-LLM gate (free) ───────────────────────────────
  const skipped = shouldSkipLlm(email.from, email.body);
  log?.log("pre_llm_gate", { email_id: email.id, sender: email.from, subject: email.subject, skipped });
  if (skipped) {
    log?.log("skipped", { reason: "not a payment notification (pre-LLM gate)" });
    return {
      status: "skipped",
      result: unverifiedResult("NOT_PAYMENT_EMAIL", "Email does not appear to be a payment notification"),
    };
  }

  // ── Step 1.5: Classifier pre-screen (cheap, optional) ─────────
  let classification: EmailClassification | undefined;
  if (options.classifier) {
    try {
      classification = await options.classifier.classify(email);
      log?.log("classifier", {
        email_id: email.id,
        classifier: options.classifier.name,
        kind: classification.kind,
        credit_probability: classification.creditProbability,
        suspicion_probability: classification.suspicionProbability,
        input_tokens: classification.usage?.inputTokens ?? null,
      });
    } catch (err) {
      // Fail open: a classifier outage costs money, never a missed payment.
      log?.log("classifier_error", {
        classifier: options.classifier.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const threshold = options.minCreditProbability ?? DEFAULT_MIN_CREDIT_PROBABILITY;
    if (classification && classification.creditProbability < threshold) {
      log?.log("skipped", {
        reason: `classifier: ${classification.kind} (P(credit)=${classification.creditProbability.toFixed(2)})`,
      });
      return {
        status: "skipped",
        result: unverifiedResult(
          "NOT_PAYMENT_EMAIL",
          `Classified as ${classification.kind}, not an incoming payment`,
        ),
        classification,
      };
    }
  }

  // ── Step 2: Rate limiter ──────────────────────────────────────
  if (options.rateLimiter) {
    try {
      await options.rateLimiter.acquire(options.rateLimitKey);
      log?.log("rate_limit", { acquired: true });
    } catch (err) {
      if (err instanceof LlmRateLimitError) {
        log?.log("rate_limit", { acquired: false, error: err.message });
        return {
          status: "skipped",
          result: unverifiedResult("NOT_PAYMENT_EMAIL", `LLM rate limit exceeded — ${err.message}`),
          classification,
        };
      }
      throw err;
    }
  }

  // ── Step 3: LLM parsing ───────────────────────────────────────
  const callbacks = options.costTracker
    ? { callbacks: [options.costTracker.asLangChainHandler()] }
    : undefined;

  log?.log("llm_call", { email_id: email.id, provider: options.llm.provider, model: options.llm.model, body_length: email.body.length });

  const parsed = await parsePaymentEmail(email, options.llm, callbacks);

  // The LLM's bankName is a free-text guess (no enum, no cross-check) and can
  // mislabel the bank even when the sender is unambiguous. When the sender
  // address matches our deterministic registry, that match is authoritative —
  // override the model's guess so the displayed/stored bank always reflects
  // who the email actually came from, not what the model inferred from body text.
  if (parsed) {
    const bankMatch = isKnownBankEmail(email.from);
    if (bankMatch.known) {
      parsed.bankName = getBankDisplayName(bankMatch.bankName);
    }
  }

  log?.log("llm_response", {
    email_id: email.id,
    parsed: !!parsed,
    response: parsed ?? null,
    is_payment_email: parsed?.isPaymentEmail ?? null,
    confidence: parsed?.confidence ?? null,
    amount: parsed?.amount ?? null,
    tokens: options.costTracker?.getUsage().totalTokens ?? null,
  });

  if (!parsed) {
    return {
      status: "skipped",
      result: unverifiedResult("NOT_PAYMENT_EMAIL", "LLM could not parse payment data from email"),
      classification,
    };
  }

  // ── Step 3.1: Post-extraction amount verification ──────────
  // Defense against prompt injection: verify the LLM-extracted amount
  // actually appears in the original email body. If not, the LLM may
  // have been manipulated into reporting a different amount.
  // Only applies when the expected amount is provided and differs from
  // what was extracted — catches injection attacks where the LLM is
  // tricked into reporting a completely fabricated amount.
  if (parsed.isPaymentEmail && parsed.amount > 0) {
    const { verifyAmountInSource } = await import("./llm/prompts.js");
    const amountInSource = verifyAmountInSource(parsed.amount, email.body);
    log?.log("amount_source_check", {
      amount: parsed.amount,
      found_in_body: amountInSource,
    });
    if (!amountInSource) {
      log?.log("amount_source_warning", {
        message: `LLM extracted amount ₹${parsed.amount} but it does not appear in the email body. Possible prompt injection or rounding.`,
      });
      // Lower confidence as a signal, but not below the 0.5 rejection threshold.
      // The amount matching layer handles the actual rejection if amounts differ.
      parsed.confidence = Math.min(parsed.confidence, 0.6);
    }
  }

  // ── Step 3.2: Classifier suspicion signal ──────────────────────
  // Same treatment as the amount-in-source check: lower confidence as a
  // signal, but leave rejection to the deterministic layers.
  if (
    classification?.suspicionProbability != null &&
    classification.suspicionProbability >= SUSPICION_THRESHOLD
  ) {
    log?.log("classifier_suspicion_warning", {
      message: `Classifier rates this email ${Math.round(classification.suspicionProbability * 100)}% likely forged or manipulative.`,
    });
    parsed.confidence = Math.min(parsed.confidence, 0.6);
  }

  return { status: "extracted", payment: parsed, classification };
}

/**
 * Stage 2 — match an already-extracted payment against one expected payment:
 * UTR hints, the security layers, and demo redaction. No LLM call.
 */
export async function matchParsedPayment(
  extracted: ParsedPayment,
  email: EmailMessage,
  options: MatchPaymentOptions,
): Promise<VerificationResult> {
  const log = options.stepLogger;
  // Each match gets its own copy: layers must not leak state between
  // the pending payments one email is compared against.
  const parsed: ParsedPayment = { ...extracted };

  // ── Step 3.5: UTR hint matching ──────────────────────────────
  // If caller provided expectedUtrs, check if the LLM-extracted UTR matches.
  // A UTR match uses relaxed (5%) amount tolerance instead of exact match,
  // but NEVER skips amount validation entirely — prevents amount bypass attacks.
  let utrMatched = false;
  if (options.expectedUtrs && options.expectedUtrs.length > 0 && parsed.upiReferenceId) {
    const { normalizeUtr } = await import("./session/utr-parser.js");
    const extractedNorm = normalizeUtr(parsed.upiReferenceId);
    utrMatched = options.expectedUtrs.some((hint) => normalizeUtr(hint) === extractedNorm);
    log?.log("utr_hint_check", {
      message: utrMatched
        ? `UTR match! ${extractedNorm} matches customer hint — using relaxed amount tolerance (5%)`
        : `UTR ${extractedNorm} does not match hints — using exact amount matching`,
      extracted_utr: extractedNorm,
      expected_utrs: options.expectedUtrs,
      matched: utrMatched,
    });
  }

  // ── Step 4: Security validation ───────────────────────────────
  // When UTR matches, allow 5% amount tolerance (handles rounding/fees)
  // but never skip amount check entirely — that's an attack vector.
  const UTR_MATCH_AMOUNT_TOLERANCE = 5;
  const amountTolerance = utrMatched
    ? Math.max(options.expected.amountTolerancePercent ?? 0, UTR_MATCH_AMOUNT_TOLERANCE)
    : (options.expected.amountTolerancePercent ?? 0);

  const securityConfig: SecurityConfig = {
    timeWindowMinutes: options.expected.timeWindowMinutes,
    amountTolerancePercent: amountTolerance,
  };

  const validator = new SecurityValidator(securityConfig, options.dedup);

  const result = await validator.validate(
    parsed,
    {
      expectedAmount: options.expected.amount,
      lookbackMinutes: options.expected.timeWindowMinutes,
    },
    email.receivedAt,
    { from: email.from, authResults: email.authResults },
  );

  // Tag how the payment was matched for tracing
  if (result.verified) {
    result.matchedVia = utrMatched ? "utr_hint" : "amount";

    // Warn when UTR matched but amount differs — possible fraud attempt
    if (utrMatched && Math.abs(parsed.amount - options.expected.amount) > 0.01) {
      log?.log("utr_amount_warning", {
        message: `UTR matched but amount differs: expected ₹${options.expected.amount}, got ₹${parsed.amount}. Passed within ${UTR_MATCH_AMOUNT_TOLERANCE}% tolerance.`,
        expected_amount: options.expected.amount,
        actual_amount: parsed.amount,
        difference_percent: Math.abs((parsed.amount - options.expected.amount) / options.expected.amount * 100).toFixed(2),
      });
    }
  }

  log?.log("security_validation", {
    verified: result.verified,
    confidence: result.confidence,
    failure_reason: result.failureReason ?? null,
    failure_details: result.failureDetails ?? null,
    layers: result.layerResults,
  });

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
 * Verify a single email message against expected payment details.
 *
 * Pipeline:
 * 1. Pre-LLM gate (regex) and optional classifier pre-screen
 * 2. Rate limiter check
 * 3. LLM parsing + post-extraction checks
 * 4. Security validation (format, bank source, amount, time, dedup)
 * 5. Demo redaction (if preset === "demo")
 *
 * When one email must be checked against many pending payments, call
 * `extractPayment` once and `matchParsedPayment` per payment instead.
 */
export async function verifyPayment(
  email: EmailMessage,
  options: VerifyPaymentOptions,
): Promise<VerificationResult> {
  const extraction = await extractPayment(email, options);
  if (extraction.status === "skipped") {
    return { ...extraction.result, classification: extraction.classification };
  }
  const result = await matchParsedPayment(extraction.payment, email, options);
  return { ...result, classification: extraction.classification };
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
  const log = options.stepLogger;
  const client = new GmailClient(options.gmail, options.customBankSenders);

  const emails = await client.fetchBankAlerts({
    lookbackMinutes: options.lookbackMinutes ?? 30,
    maxResults: options.maxEmails ?? 10,
  });

  log?.log("gmail_fetch", {
    lookback_minutes: options.lookbackMinutes ?? 30,
    max_results: options.maxEmails ?? 10,
    emails_found: emails.length,
    email_ids: emails.map((e) => e.id),
    senders: emails.map((e) => e.from),
    subjects: emails.map((e) => e.subject),
  });

  // Track all message IDs we've seen (including previously skipped ones)
  const allProcessedIds = [
    ...(options.skipMessageIds ?? []),
    ...emails.map((e) => e.id),
  ];

  if (emails.length === 0) {
    log?.log("no_emails", { reason: "No bank alert emails found" });
    const r = unverifiedResult(
      "NOT_PAYMENT_EMAIL",
      "No bank alert emails found in the specified time window",
    );
    r.processedMessageIds = allProcessedIds;
    r.steps = log?.getSteps();
    return r;
  }

  // Skip emails already parsed by previous polls to avoid wasting LLM tokens
  const skip = options.skipMessageIds;
  const newEmails = skip ? emails.filter((e) => !skip.has(e.id)) : emails;

  log?.log("dedup_filter", {
    total_fetched: emails.length,
    already_seen: skip?.size ?? 0,
    new_emails: newEmails.length,
  });

  if (newEmails.length === 0) {
    const r = unverifiedResult(
      "NOT_PAYMENT_EMAIL",
      "No new bank alert emails since last check",
    );
    r.processedMessageIds = allProcessedIds;
    return r;
  }

  let lastResult: VerificationResult | null = null;

  for (const email of newEmails) {
    log?.log("email_check", { email_id: email.id, sender: email.from, subject: email.subject, body_length: email.body.length });
    const result = await verifyPayment(email, options);

    if (result.verified) {
      log?.log("verified", { email_id: email.id, confidence: result.confidence });
      result.processedMessageIds = allProcessedIds;
      result.steps = log?.getSteps();
      return result;
    }

    lastResult = result;
  }

  // No verified match found — return the last unverified result
  log?.log("no_match", { emails_checked: newEmails.length });
  lastResult!.processedMessageIds = allProcessedIds;
  lastResult!.steps = log?.getSteps();
  return lastResult!;
}

/**
 * Security Validation Pipeline
 *
 * Runs parsed payment data through 4 security layers in sequence.
 * Each layer checks for a different class of attack or error.
 * The pipeline stops at the first failure (fail-fast) — no point
 * checking duplicates if the amount doesn't even match.
 *
 * This is the "Chain of Responsibility" pattern: each layer either
 * passes the request to the next layer or rejects it. The pattern
 * is common in security middleware (think Express middleware, but
 * for payment validation).
 */

import type { ParsedPayment } from "../llm/schema.js";
import type {
  SecurityConfig,
  VerificationRequest,
  ValidationResult,
  VerificationResult,
} from "./types.js";
import type { DedupStore } from "./dedup.js";
import { InMemoryDedupStore } from "./dedup.js";
import { isKnownBankEmail } from "./bank-registry.js";

export class SecurityValidator {
  private config: Required<SecurityConfig>;
  private dedupStore: DedupStore;

  constructor(config: SecurityConfig = {}, dedupStore?: DedupStore) {
    // Fill in defaults. Required<SecurityConfig> means all fields are present
    // after this point — no more optional checks needed downstream.
    this.config = {
      timeWindowMinutes: config.timeWindowMinutes ?? 30,
      amountTolerancePercent: config.amountTolerancePercent ?? 0,
    };

    this.dedupStore = dedupStore ?? new InMemoryDedupStore(this.config.timeWindowMinutes * 2);
  }

  /**
   * Run the full validation pipeline on parsed payment data.
   *
   * Returns a detailed result showing which layers passed/failed.
   * This transparency is important for debugging — when a payment
   * is rejected, the consumer needs to know WHY.
   */
  async validate(
    payment: ParsedPayment,
    request: VerificationRequest,
    /** Email's received timestamp from Gmail — used as fallback when LLM can't extract exact time */
    emailReceivedAt?: Date,
    /** Optional email metadata — used for bank source validation */
    emailMeta?: { from?: string },
  ): Promise<VerificationResult> {
    const layerResults: VerificationResult["layerResults"] = [];

    // ── Layer 1: Format Validation ──────────────────────────────
    // "Is this even a valid payment email?"
    const formatResult = this.validateFormat(payment);
    layerResults.push({ layer: "format", ...formatResult });
    if (!formatResult.passed) {
      return this.buildResult(false, payment, layerResults, formatResult);
    }

    // ── Layer 1.5: Bank Source Validation ──────────────────────
    // "Is this from a known bank? If not, require higher confidence."
    const bankSourceResult = this.validateBankSource(payment, emailMeta?.from);
    layerResults.push({ layer: "bank_source", ...bankSourceResult });
    if (!bankSourceResult.passed) {
      return this.buildResult(false, payment, layerResults, bankSourceResult);
    }

    // ── Layer 2: Amount Matching ────────────────────────────────
    // "Does the amount match what we expected?"
    const amountResult = this.validateAmount(payment, request);
    layerResults.push({ layer: "amount", ...amountResult });
    if (!amountResult.passed) {
      return this.buildResult(false, payment, layerResults, amountResult);
    }

    // ── Layer 3: Time Window ────────────────────────────────────
    // "Is this payment recent enough?"
    const timeResult = this.validateTimeWindow(payment, request, emailReceivedAt);
    layerResults.push({ layer: "time_window", ...timeResult });
    if (!timeResult.passed) {
      return this.buildResult(false, payment, layerResults, timeResult);
    }

    // ── Layer 4: Duplicate Detection ────────────────────────────
    // "Have we seen this UPI reference before?"
    const dedupResult = await this.validateDuplicate(payment);
    layerResults.push({ layer: "duplicate", ...dedupResult });
    if (!dedupResult.passed) {
      return this.buildResult(false, payment, layerResults, dedupResult);
    }

    // All layers passed — mark this reference ID as processed
    await this.dedupStore.add(payment.upiReferenceId);

    return this.buildResult(true, payment, layerResults);
  }

  /**
   * Layer 1.5: Bank Source Validation
   *
   * Checks whether the email sender is a known bank address.
   *
   * If the sender is a recognized bank (from the registry), we trust
   * the existing 0.5 confidence threshold from Layer 1.
   *
   * If the sender is unknown, we require a higher confidence of 0.8.
   * This guards against spam or spoofed emails that happen to look like
   * payment notifications — unknown senders need to earn their way through
   * with a much stronger LLM signal.
   *
   * If no fromAddress is provided, the layer is skipped (backwards compat).
   */
  private validateBankSource(
    payment: ParsedPayment,
    fromAddress?: string,
  ): ValidationResult {
    if (!fromAddress) {
      return { passed: true, details: "No sender address provided, skipping bank source check" };
    }

    const bankResult = isKnownBankEmail(fromAddress);

    if (bankResult.known) {
      return { passed: true, details: `Known bank: ${bankResult.bankName}` };
    }

    if (payment.confidence < 0.8) {
      return {
        passed: false,
        reason: "LOW_CONFIDENCE",
        details: `Confidence ${payment.confidence} below 0.8 threshold for unknown sender "${fromAddress}"`,
      };
    }

    return {
      passed: true,
      details: `Unknown sender "${fromAddress}" accepted with high confidence ${payment.confidence}`,
    };
  }

  /**
   * Layer 1: Format Validation
   *
   * Checks the LLM output makes basic sense:
   * - Is this actually a payment email? (LLM's own assessment)
   * - Is the LLM confident enough in its extraction?
   *
   * Why check the LLM's own confidence? Because the LLM knows when it's
   * struggling. If it says confidence: 0.3, it's telling us "I'm not sure
   * about this extraction." Trusting low-confidence results is asking for
   * hallucinated payment data.
   *
   * Threshold: 0.5 (configurable in future). Below this, we reject.
   */
  private validateFormat(payment: ParsedPayment): ValidationResult {
    if (!payment.isPaymentEmail) {
      return {
        passed: false,
        reason: "NOT_PAYMENT_EMAIL",
        details: "LLM determined this is not a payment credit email",
      };
    }

    if (payment.confidence < 0.5) {
      return {
        passed: false,
        reason: "LOW_CONFIDENCE",
        details: `LLM confidence ${payment.confidence} is below threshold 0.5`,
      };
    }

    return { passed: true };
  }

  /**
   * Layer 2: Amount Matching
   *
   * Compares the LLM-extracted amount against the expected amount.
   *
   * Why is this critical? Consider: a user claims they paid Rs.10,000
   * for a product. The LLM correctly extracts Rs.100 from their actual
   * bank email. Without amount matching, you'd just trust the LLM output
   * and not catch the discrepancy between what was claimed and what was paid.
   *
   * The tolerance is intentionally 0 by default (exact match). See the
   * SecurityConfig type for why fuzzy matching is dangerous for payments.
   */
  private validateAmount(
    payment: ParsedPayment,
    request: VerificationRequest,
  ): ValidationResult {
    const expected = request.expectedAmount;
    const actual = payment.amount;
    const tolerancePercent = this.config.amountTolerancePercent;

    if (tolerancePercent === 0) {
      // Exact match — compare with floating point safety.
      // Why Math.abs and epsilon? Floating point math:
      // 0.1 + 0.2 === 0.30000000000000004 in JavaScript.
      // For money, we compare to 0.01 (1 paisa) precision.
      if (Math.abs(actual - expected) > 0.01) {
        return {
          passed: false,
          reason: "AMOUNT_MISMATCH",
          details: `Expected ₹${expected}, got ₹${actual}`,
        };
      }
    } else {
      const tolerance = expected * (tolerancePercent / 100);
      if (Math.abs(actual - expected) > tolerance) {
        return {
          passed: false,
          reason: "AMOUNT_MISMATCH",
          details: `Expected ₹${expected} (±${tolerancePercent}%), got ₹${actual}`,
        };
      }
    }

    return { passed: true };
  }

  /**
   * Layer 3: Time Window Validation
   *
   * Checks that the payment timestamp is within the acceptable window.
   *
   * This prevents replay attacks: someone can't take a week-old payment
   * email and use it to "verify" a new purchase. The window is configurable
   * but defaults to 30 minutes.
   *
   * We check two things:
   * 1. The email's receivedAt (from Gmail) — when Gmail got the email
   * 2. The payment's timestamp (from LLM) — when the bank says the txn happened
   *
   * We use the LLM-extracted timestamp if available, otherwise fall back
   * to email received time. Why? Because the email might arrive minutes
   * after the actual transaction.
   */
  private validateTimeWindow(
    payment: ParsedPayment,
    request: VerificationRequest,
    emailReceivedAt?: Date,
  ): ValidationResult {
    const windowMinutes = request.lookbackMinutes ?? this.config.timeWindowMinutes;
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    // Determine the best timestamp to use:
    // 1. LLM-extracted timestamp — if it has a real time (not midnight)
    // 2. Email receivedAt from Gmail — reliable server-side timestamp
    //
    // Why check for midnight? Many bank emails (especially HDFC) don't include
    // the exact transaction time in the email body. The LLM defaults to T00:00:00
    // which makes the payment look hours old even if it just happened.
    // Gmail's receivedAt is when the email actually arrived — much more accurate.
    let paymentTime: number | null = null;

    if (payment.timestamp) {
      const parsed = new Date(payment.timestamp).getTime();
      if (!isNaN(parsed)) {
        // Check if this is a midnight timestamp (LLM couldn't extract exact time)
        const d = new Date(parsed);
        const isMidnight = d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;

        if (isMidnight && emailReceivedAt) {
          // LLM gave us just the date — fall back to Gmail's received timestamp
          paymentTime = emailReceivedAt.getTime();
        } else {
          paymentTime = parsed;
        }
      }
    }

    // If we still don't have a timestamp, use emailReceivedAt
    if (paymentTime === null && emailReceivedAt) {
      paymentTime = emailReceivedAt.getTime();
    }

    if (paymentTime !== null) {
      const age = now - paymentTime;

      if (age > windowMs) {
        const ageMinutes = Math.round(age / 60000);
        return {
          passed: false,
          reason: "OUTSIDE_TIME_WINDOW",
          details: `Payment is ${ageMinutes} minutes old, window is ${windowMinutes} minutes`,
        };
      }

      // Reject future-dated payments (clock skew attack or LLM error)
      // Allow 5 minutes of clock skew tolerance
      if (age < -5 * 60 * 1000) {
        return {
          passed: false,
          reason: "OUTSIDE_TIME_WINDOW",
          details: "Payment timestamp is in the future",
        };
      }
    }

    return { passed: true };
  }

  /**
   * Layer 4: Duplicate Detection
   *
   * Checks if we've already processed this UPI reference ID.
   *
   * This is the last line of defense against double-crediting.
   * Even if all other layers pass, a duplicate ref ID means this
   * exact transaction was already verified and credited.
   *
   * Important: We check BEFORE marking as processed. The marking
   * happens after ALL layers pass (in the validate method).
   * This ensures we don't accidentally block a legit transaction
   * if a later layer rejects it.
   */
  private async validateDuplicate(payment: ParsedPayment): Promise<ValidationResult> {
    const isDuplicate = await this.dedupStore.has(payment.upiReferenceId);

    if (isDuplicate) {
      return {
        passed: false,
        reason: "DUPLICATE_TRANSACTION",
        details: `UPI reference ${payment.upiReferenceId} has already been processed`,
      };
    }

    return { passed: true };
  }

  /**
   * Builds a standardized VerificationResult.
   * Keeps the validate() method clean by extracting result construction.
   */
  private buildResult(
    verified: boolean,
    payment: ParsedPayment,
    layerResults: VerificationResult["layerResults"],
    failedLayer?: ValidationResult,
  ): VerificationResult {
    return {
      verified,
      payment,
      confidence: payment.confidence,
      failureReason: failedLayer?.reason,
      failureDetails: failedLayer?.details,
      layerResults,
    };
  }
}

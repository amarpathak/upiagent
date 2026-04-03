/**
 * Security Layer Types
 *
 * These types define the inputs, outputs, and configuration for each
 * security validation layer. By making each layer's contract explicit,
 * we can test them independently and swap implementations.
 */

import type { ParsedPayment } from "../llm/schema.js";

/**
 * Configuration for the security validation pipeline.
 */
export interface SecurityConfig {
  /**
   * How many minutes old a payment can be and still be accepted.
   * Default: 30 minutes.
   *
   * Why 30 minutes? UPI transactions settle in seconds, but bank alert
   * emails can be delayed by a few minutes. 30 minutes gives plenty of
   * buffer while still protecting against stale replay attacks.
   *
   * Shorter = more secure but might reject legitimate slow emails.
   * Longer = more permissive but wider window for replay attacks.
   */
  timeWindowMinutes?: number;

  /**
   * Percentage tolerance for amount matching. Default: 0 (exact match).
   *
   * Why default to 0 (exact match)? For financial verification, even
   * Rs.1 difference matters. Fuzzy matching is DANGEROUS here because:
   * - Attacker pays Rs.99 for a Rs.100 item
   * - With 2% tolerance, that's accepted
   * - For high-value transactions, 2% of Rs.50,000 = Rs.1,000 loss
   *
   * The only case for non-zero tolerance is when bank emails round amounts
   * (e.g., showing Rs.499 instead of Rs.499.00). But LLM parsing handles
   * this — the LLM extracts 499.00 from "Rs.499" correctly.
   *
   * FDE note: If a client asks for fuzzy matching, explain the risk first.
   * Make them explicitly opt in.
   */
  amountTolerancePercent?: number;
}

/**
 * What the caller wants to verify against — the "expected" payment.
 */
export interface VerificationRequest {
  /** The amount the caller expects to have been paid */
  expectedAmount: number;

  /** Optional: expected sender UPI ID */
  expectedFrom?: string;

  /** How many minutes back to look for the payment (default: 30) */
  lookbackMinutes?: number;
}

/**
 * Reason codes for why a verification failed.
 *
 * These are machine-readable codes (not human messages) so consumers
 * can programmatically handle different failure modes. For example,
 * a "DUPLICATE" might trigger a "you've already been credited" message,
 * while "AMOUNT_MISMATCH" might trigger "incorrect amount paid."
 */
export type ValidationFailureReason =
  | "NOT_PAYMENT_EMAIL"
  | "LOW_CONFIDENCE"
  | "AMOUNT_MISMATCH"
  | "OUTSIDE_TIME_WINDOW"
  | "DUPLICATE_TRANSACTION"
  | "FORMAT_INVALID";

/**
 * Result of a single validation layer.
 *
 * Each layer returns this. If passed is false, the reason explains why.
 * The pipeline stops at the first failure (fail-fast).
 */
export interface ValidationResult {
  passed: boolean;
  reason?: ValidationFailureReason;
  details?: string;
}

/**
 * The final result of the full verification pipeline.
 */
export interface VerificationResult {
  /** Whether the payment passed all security layers */
  verified: boolean;

  /** The parsed payment data (available even if verification failed) */
  payment: ParsedPayment | null;

  /** LLM confidence score (0-1) */
  confidence: number;

  /** Which layer failed, if any */
  failureReason?: ValidationFailureReason;

  /** Human-readable details about the failure */
  failureDetails?: string;

  /** How the payment was matched — UTR hint or amount (default) */
  matchedVia?: "utr_hint" | "amount";

  /** Which layers were checked and their results */
  layerResults: {
    layer: string;
    passed: boolean;
    details?: string;
  }[];

  /** Gmail message IDs processed in this verification — used to skip on next poll */
  processedMessageIds?: string[];

  /** Step-by-step pipeline trace for debugging and training data */
  steps?: { step: string; ts: string; [key: string]: unknown }[];
}

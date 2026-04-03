/**
 * Session Types — UTR pre-registration & verification session
 *
 * A verification session manages the lifecycle of a single payment verification:
 * 1. create → poll Gmail with amount matching (original flow, ~3 min)
 * 2. If still unresolved → escalate to "awaiting_utr" → UI shows "Share your UTR"
 * 3. Customer shares UTR → polls now include UTR hints for faster matching
 * 4. Resolve or timeout
 *
 * UTR from the user is a HINT only. The bank alert email is always the authority.
 */

import type { GmailCredentials } from "../gmail/types.js";
import type { LlmConfig } from "../llm/types.js";
import type { DedupStore } from "../security/dedup.js";
import type { VerificationResult } from "../security/types.js";
import type { CostTracker } from "../utils/cost.js";
import type { LlmRateLimiter } from "../utils/rate-limiter.js";
import type { VerificationPreset } from "../verify.js";

// ── Session Status ──────────────────────────────────────────────────

export type SessionStatus = "pending" | "awaiting_utr" | "verified" | "timeout" | "cancelled";

// ── UTR Types ───────────────────────────────────────────────────────

export type UtrSource = "text" | "ocr";
export type UtrPatternSource = "labeled" | "imps" | "neft" | "fallback";

export interface PendingUtr {
  utr: string;
  source: UtrSource;
  registeredAt: Date;
}

export interface UtrCandidate {
  utr: string;
  source: UtrPatternSource;
  confidence: number;
}

// ── Session Config ──────────────────────────────────────────────────

export interface VerificationSessionConfig {
  /** Expected payment amount in INR */
  amount: number;

  /** Optional order ID for tracing */
  orderId?: string;

  /** Session timeout in milliseconds. Default: 10 minutes (600_000) */
  timeoutMs?: number;

  /** Poll interval in milliseconds. Default: 5 seconds (5_000) */
  pollIntervalMs?: number;

  /** Gmail lookback window in minutes per poll. Default: 30 */
  lookbackMinutes?: number;

  /** Max emails to fetch per poll. Default: 10 */
  maxEmails?: number;

  /** Time window for payment validity in minutes. Default: 30 */
  timeWindowMinutes?: number;

  /** Amount tolerance percent. Default: 0 (exact match) */
  amountTolerancePercent?: number;

  /**
   * How long to poll with amount-matching only before escalating to UTR sharing.
   * After this delay, status becomes "awaiting_utr" and onAwaitingUtr fires.
   * Default: 20 seconds (20_000ms)
   */
  utrDelayMs?: number;

  /** Callback when payment is verified */
  onVerified?: (result: VerificationResult) => void;

  /** Callback when session times out */
  onTimeout?: () => void;

  /**
   * Callback when polling hasn't found a match and the session is ready
   * for the customer to share their UTR. Use this to show "Share your payment status" UI.
   */
  onAwaitingUtr?: () => void;

  /** Gmail credentials */
  gmail: GmailCredentials;

  /** LLM configuration for email parsing */
  llm: LlmConfig;

  /** Optional dedup store (shared across sessions) */
  dedup?: DedupStore;

  /** Optional rate limiter */
  rateLimiter?: LlmRateLimiter;

  /** Optional cost tracker */
  costTracker?: CostTracker;

  /** Optional preset (e.g. "demo" for PII redaction) */
  preset?: VerificationPreset;
}

// ── Session Handle ──────────────────────────────────────────────────

export interface VerificationSession {
  /** Unique session identifier */
  sessionId: string;

  /** Current session status */
  status: SessionStatus;

  /**
   * Register a UTR hint — extracted from text input or OCR.
   * The UTR is stored as a hint; bank alert email is the authority.
   */
  registerUTR(input: string, source?: UtrSource): void;

  /** Cancel the session and stop polling */
  cancel(): void;

  /**
   * Promise that resolves when the session completes (verified, timeout, or cancelled).
   * Resolves with the VerificationResult on success, null on timeout/cancel.
   */
  promise: Promise<VerificationResult | null>;
}

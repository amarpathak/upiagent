/**
 * Verification Session Manager
 *
 * Ties together the UTR store, polling loop, and timeout management.
 *
 * Flow:
 * 1. createVerificationSession() → starts polling with amount matching (existing flow)
 * 2. Polls for utrDelayMs (default 3min) using amount matching only
 * 3. If still unresolved → status becomes "awaiting_utr", fires onAwaitingUtr callback
 *    → UI shows "Share your payment status" option
 * 4. Customer pastes UTR or uploads screenshot → session.registerUTR()
 * 5. Subsequent polls now include UTR hints alongside amount matching
 * 6. If UTR matches bank alert → immediate resolve
 * 7. On timeout → cleanup and call onTimeout callback
 */

import { randomUUID } from "node:crypto";
import type {
  VerificationSessionConfig,
  VerificationSession,
  SessionStatus,
  UtrSource,
} from "./types.js";
import type { VerificationResult } from "../security/types.js";
import { InMemoryUtrStore, type UtrStore } from "./utr-store.js";
import { extractUtrFromText } from "./utr-parser.js";
import { fetchAndVerifyPayment } from "../verify.js";
import { StepLogger } from "../utils/step-logger.js";

// Default config values
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;  // 10 minutes
const DEFAULT_POLL_INTERVAL_MS = 5_000;      // 5 seconds
const DEFAULT_UTR_DELAY_MS = 20_000;          // 20 seconds

/**
 * Create a managed verification session.
 *
 * The session polls Gmail for bank alerts using amount matching first.
 * After utrDelayMs (default 3min), it escalates to "awaiting_utr" status
 * and fires onAwaitingUtr so the UI can offer "Share your UTR" to the customer.
 * registerUTR() only accepts hints once the session is in "awaiting_utr" status.
 *
 * @param config - Session configuration
 * @param utrStore - Optional shared UTR store (default: creates a new InMemoryUtrStore)
 */
export function createVerificationSession(
  config: VerificationSessionConfig,
  utrStore?: UtrStore,
): VerificationSession {
  const sessionId = randomUUID();
  const store = utrStore ?? new InMemoryUtrStore();
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const utrDelayMs = config.utrDelayMs ?? DEFAULT_UTR_DELAY_MS;
  const abortController = new AbortController();

  let status: SessionStatus = "pending";
  let resolvePromise: (result: VerificationResult | null) => void;

  const promise = new Promise<VerificationResult | null>((resolve) => {
    resolvePromise = resolve;
  });

  // Track which Gmail message IDs we've already processed to avoid re-parsing
  const processedMessageIds = new Set<string>();

  // ── Polling loop ────────────────────────────────────────────────

  async function poll(): Promise<void> {
    if (abortController.signal.aborted) return;

    const log = new StepLogger();

    // Only include UTR hints after the session has escalated to awaiting_utr
    const expectedUtrs = status === "awaiting_utr"
      ? store.getExpectedUtrs(sessionId)
      : [];

    log.log("session_poll", {
      session_id: sessionId,
      status,
      expected_utrs: expectedUtrs,
      processed_ids_count: processedMessageIds.size,
    });

    try {
      const result = await fetchAndVerifyPayment({
        gmail: config.gmail,
        llm: config.llm,
        expected: {
          amount: config.amount,
          timeWindowMinutes: config.timeWindowMinutes,
          amountTolerancePercent: config.amountTolerancePercent,
        },
        expectedUtrs: expectedUtrs.length > 0 ? expectedUtrs : undefined,
        dedup: config.dedup,
        rateLimiter: config.rateLimiter,
        costTracker: config.costTracker,
        stepLogger: log,
        preset: config.preset,
        lookbackMinutes: config.lookbackMinutes,
        maxEmails: config.maxEmails,
        skipMessageIds: processedMessageIds,
      });

      // Track processed message IDs for next poll
      if (result.processedMessageIds) {
        for (const id of result.processedMessageIds) {
          processedMessageIds.add(id);
        }
      }

      if (result.verified) {
        status = "verified";
        cleanup();
        config.onVerified?.(result);
        resolvePromise(result);
        return;
      }
    } catch (err) {
      // Log but don't crash the session — next poll may succeed
      log.log("poll_error", { error: String(err) });
    }

    // Schedule next poll if not aborted
    if (!abortController.signal.aborted) {
      setTimeout(poll, pollIntervalMs);
    }
  }

  // ── UTR delay — escalate after polling fails for utrDelayMs ───

  const utrDelayHandle = setTimeout(() => {
    if (status === "pending") {
      status = "awaiting_utr";
      config.onAwaitingUtr?.();
    }
  }, utrDelayMs);

  // ── Timeout ─────────────────────────────────────────────────────

  const timeoutHandle = setTimeout(() => {
    if (status === "pending" || status === "awaiting_utr") {
      status = "timeout";
      abortController.abort();
      cleanup();
      config.onTimeout?.();
      resolvePromise(null);
    }
  }, timeoutMs);

  // ── Cleanup ─────────────────────────────────────────────────────

  function cleanup() {
    clearTimeout(timeoutHandle);
    clearTimeout(utrDelayHandle);
    store.removeSession(sessionId);
  }

  // ── Register UTR ────────────────────────────────────────────────

  /**
   * Register a UTR hint. Only works after the session has escalated to
   * "awaiting_utr" status (after utrDelayMs of unsuccessful polling).
   * Before that, the system relies on amount matching alone.
   */
  function registerUTR(input: string, source: UtrSource = "text"): void {
    if (status !== "awaiting_utr") return; // Not yet in UTR phase

    const candidates = extractUtrFromText(input);
    for (const candidate of candidates) {
      store.register(sessionId, candidate.utr, source);
    }
  }

  // ── Cancel ──────────────────────────────────────────────────────

  function cancel(): void {
    if (status === "pending" || status === "awaiting_utr") {
      status = "cancelled";
      abortController.abort();
      cleanup();
      resolvePromise(null);
    }
  }

  // Start polling on next tick (let caller attach handlers first)
  setTimeout(poll, 0);

  return {
    sessionId,
    get status() {
      return status;
    },
    registerUTR,
    cancel,
    promise,
  };
}

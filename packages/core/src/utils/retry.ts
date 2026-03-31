/**
 * Retry Logic with Exponential Backoff
 *
 * LLM APIs and Gmail API both have transient failures — network blips,
 * rate limits, temporary server errors. Retry logic handles these
 * automatically instead of failing on the first hiccup.
 *
 * Exponential backoff pattern:
 *   Attempt 1: wait 0ms (immediate)
 *   Attempt 2: wait 1000ms
 *   Attempt 3: wait 2000ms
 *   Attempt 4: wait 4000ms
 *
 * Why exponential? If the server is overloaded, hammering it with retries
 * makes it worse. Backing off gives it time to recover. This is standard
 * practice for any API client.
 *
 * Why jitter? If 100 clients all retry at exactly 1000ms, they hit the
 * server simultaneously again. Random jitter spreads out the retries.
 */

import type { Logger } from "./logger.js";

export interface RetryOptions {
  /** Maximum number of attempts (including the first) */
  maxAttempts?: number;

  /** Base delay in ms between retries (doubled each time) */
  baseDelayMs?: number;

  /** Maximum delay cap in ms */
  maxDelayMs?: number;

  /** Logger instance for retry logging */
  logger?: Logger;

  /** Which errors should trigger a retry (default: all) */
  retryIf?: (error: unknown) => boolean;
}

/**
 * Executes a function with automatic retry on failure.
 *
 * Generic return type <T> means it preserves the type of whatever
 * function you pass in. If you retry a function that returns ParsedPayment,
 * withRetry also returns ParsedPayment.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    logger,
    retryIf = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if this error is retryable
      if (!retryIf(error) || attempt === maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * baseDelayMs * 0.5; // Up to 50% jitter
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      logger?.warn("Retrying after transient error", {
        attempt,
        maxAttempts,
        delayMs: Math.round(delay),
        error: error instanceof Error ? error.message : String(error),
      });

      await sleep(delay);
    }
  }

  // TypeScript needs this even though it's unreachable
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

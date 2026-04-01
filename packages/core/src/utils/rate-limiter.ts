import { LlmRateLimitError } from "./errors.js";

interface RateLimiterOptions {
  maxCallsPerMinute: number;
  maxCallsPerHour?: number;
}

export class LlmRateLimiter {
  private readonly maxPerMinute: number;
  private readonly maxPerHour: number | undefined;
  private readonly minuteWindows: Map<string, number[]> = new Map();
  private readonly hourWindows: Map<string, number[]> = new Map();

  constructor(opts: RateLimiterOptions) {
    this.maxPerMinute = opts.maxCallsPerMinute;
    this.maxPerHour = opts.maxCallsPerHour;
  }

  async acquire(key: string = "__global__"): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    const oneHourAgo = now - 3_600_000;

    const minuteTimestamps = this.minuteWindows.get(key) ?? [];
    const recentMinute = minuteTimestamps.filter((t) => t > oneMinuteAgo);

    if (recentMinute.length >= this.maxPerMinute) {
      const oldestInWindow = recentMinute[0]!;
      const retryAfterMs = oldestInWindow + 60_000 - now;
      throw new LlmRateLimitError(
        `LLM rate limit exceeded: ${this.maxPerMinute} calls/minute for key "${key}"`,
        retryAfterMs
      );
    }

    if (this.maxPerHour !== undefined) {
      const hourTimestamps = this.hourWindows.get(key) ?? [];
      const recentHour = hourTimestamps.filter((t) => t > oneHourAgo);

      if (recentHour.length >= this.maxPerHour) {
        const oldestInWindow = recentHour[0]!;
        const retryAfterMs = oldestInWindow + 3_600_000 - now;
        throw new LlmRateLimitError(
          `LLM rate limit exceeded: ${this.maxPerHour} calls/hour for key "${key}"`,
          retryAfterMs
        );
      }

      recentHour.push(now);
      this.hourWindows.set(key, recentHour);
    }

    recentMinute.push(now);
    this.minuteWindows.set(key, recentMinute);
  }
}

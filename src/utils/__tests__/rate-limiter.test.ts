import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LlmRateLimiter } from "../rate-limiter.js";
import { LlmRateLimitError } from "../errors.js";

describe("LlmRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows calls within per-minute limit", async () => {
    const limiter = new LlmRateLimiter({ maxCallsPerMinute: 3 });
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
  });

  it("throws LlmRateLimitError when per-minute limit exceeded", async () => {
    const limiter = new LlmRateLimiter({ maxCallsPerMinute: 2 });
    await limiter.acquire();
    await limiter.acquire();
    await expect(limiter.acquire()).rejects.toThrow(LlmRateLimitError);
  });

  it("resets after the minute window passes", async () => {
    const limiter = new LlmRateLimiter({ maxCallsPerMinute: 1 });
    await limiter.acquire();
    await expect(limiter.acquire()).rejects.toThrow(LlmRateLimitError);
    vi.advanceTimersByTime(61_000);
    await limiter.acquire();
  });

  it("tracks per-key limits independently", async () => {
    const limiter = new LlmRateLimiter({ maxCallsPerMinute: 1 });
    await limiter.acquire("merchant-a");
    await limiter.acquire("merchant-b");
    await expect(limiter.acquire("merchant-a")).rejects.toThrow(LlmRateLimitError);
  });

  it("enforces per-hour limit", async () => {
    const limiter = new LlmRateLimiter({ maxCallsPerMinute: 100, maxCallsPerHour: 3 });
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    await expect(limiter.acquire()).rejects.toThrow(LlmRateLimitError);
  });

  it("includes retryAfterMs in error", async () => {
    const limiter = new LlmRateLimiter({ maxCallsPerMinute: 1 });
    await limiter.acquire();
    try {
      await limiter.acquire();
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmRateLimitError);
      expect((e as LlmRateLimitError).retryAfterMs).toBeGreaterThan(0);
    }
  });
});

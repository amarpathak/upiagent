/**
 * Duplicate Transaction Detection
 *
 * Tracks UPI reference IDs that have already been processed to prevent
 * double-crediting. This is "idempotency" — ensuring the same input
 * produces the same outcome, no matter how many times it's received.
 *
 * Why idempotency matters for payments:
 * - Network retry: Your code crashes after verifying but before recording.
 *   On restart, it processes the same email again → double credit.
 * - Attacker replay: Someone captures a valid payment email and submits
 *   the same UPI ref ID again → double credit.
 * - Email duplication: Gmail occasionally delivers the same email twice
 *   (rare but documented) → double credit.
 *
 * Implementation: In-memory Set with TTL (time-to-live).
 *
 * Decision: Why in-memory instead of database?
 *
 *   Option A: In-memory Set
 *     + Zero dependencies, works everywhere
 *     + Fast (O(1) lookup)
 *     - Lost on process restart
 *     - Doesn't work across multiple server instances
 *
 *   Option B: Redis/database
 *     + Persists across restarts
 *     + Works across instances
 *     - Adds infrastructure dependency
 *     - Overkill for most use cases
 *
 *   → Going with A (in-memory) with a pluggable interface.
 *   The default works for single-server deployments (most upiagent users).
 *   Consumers who need distributed dedup can provide their own store via
 *   the DedupStore interface.
 *
 * FDE insight: Start with the simplest implementation, but design the
 * interface so it can be swapped later. "Make it work, make it right,
 * make it fast" — in that order.
 */

/**
 * Interface for dedup storage backends.
 * Consumers can implement this to use Redis, a database, etc.
 */
export interface DedupStore {
  /** Check if a reference ID has been seen before */
  has(referenceId: string): Promise<boolean>;
  /** Mark a reference ID as processed */
  add(referenceId: string, ttlMinutes?: number): Promise<void>;
}

/**
 * In-memory dedup store with automatic expiry.
 *
 * Entries are automatically removed after `ttlMinutes` to prevent
 * unbounded memory growth. The TTL should be longer than your
 * time window — there's no point tracking a ref ID for 24 hours
 * if you only accept payments from the last 30 minutes.
 */
export class InMemoryDedupStore implements DedupStore {
  private store: Map<string, number> = new Map();
  private ttlMs: number;

  constructor(ttlMinutes: number = 60) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  async has(referenceId: string): Promise<boolean> {
    this.cleanup();
    return this.store.has(referenceId);
  }

  async add(referenceId: string, _ttlMinutes?: number): Promise<void> {
    this.store.set(referenceId, Date.now());
  }

  /**
   * Removes expired entries. Called on every `has` check.
   *
   * Why lazy cleanup? Running a periodic timer (setInterval) in a library
   * is bad practice — it keeps the Node.js process alive and can cause
   * memory leaks if the consumer doesn't explicitly shut it down.
   * Lazy cleanup on read is simpler and has no lifecycle issues.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.store) {
      if (now - timestamp > this.ttlMs) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * UTR Hint Store — maps UTR hints to session IDs for O(1) lookup.
 *
 * When a bank alert arrives, we extract the UTR from the email and check
 * if any active session has pre-registered that UTR as a hint. If yes,
 * we resolve that session immediately instead of relying on amount matching.
 *
 * Design follows the same pluggable interface pattern as DedupStore:
 * in-memory default, swappable for Redis/DB in production.
 */

import { normalizeUtr } from "./utr-parser.js";
import type { PendingUtr, UtrSource } from "./types.js";

// ── Interface ───────────────────────────────────────────────────────

export interface UtrStore {
  /** Register a UTR hint for a session */
  register(sessionId: string, utr: string, source: UtrSource): void;

  /** Find which session (if any) registered this UTR */
  findSessionByUtr(utr: string): string | undefined;

  /** Get all pending UTRs for a session */
  getSessionUtrs(sessionId: string): PendingUtr[];

  /** Get all normalized UTR strings for a session (for passing to verify) */
  getExpectedUtrs(sessionId: string): string[];

  /** Remove all UTR hints for a session (cleanup on resolve/timeout/cancel) */
  removeSession(sessionId: string): void;
}

// ── In-Memory Implementation ────────────────────────────────────────

export class InMemoryUtrStore implements UtrStore {
  /** sessionId → PendingUtr[] */
  private sessions: Map<string, PendingUtr[]> = new Map();

  /** normalizedUtr → sessionId (reverse index for O(1) lookup) */
  private reverseIndex: Map<string, string> = new Map();

  register(sessionId: string, utr: string, source: UtrSource): void {
    const normalized = normalizeUtr(utr);
    if (normalized.length < 9) return; // Too short to be a valid UTR

    // Don't register duplicates for the same session
    const existing = this.sessions.get(sessionId);
    if (existing?.some((p) => p.utr === normalized)) return;

    const pending: PendingUtr = {
      utr: normalized,
      source,
      registeredAt: new Date(),
    };

    // Forward index
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, []);
    }
    this.sessions.get(sessionId)!.push(pending);

    // Reverse index — if another session already claimed this UTR, overwrite
    // (latest registration wins; in practice, UTRs are unique per transaction)
    this.reverseIndex.set(normalized, sessionId);
  }

  findSessionByUtr(utr: string): string | undefined {
    const normalized = normalizeUtr(utr);
    return this.reverseIndex.get(normalized);
  }

  getSessionUtrs(sessionId: string): PendingUtr[] {
    return this.sessions.get(sessionId) ?? [];
  }

  getExpectedUtrs(sessionId: string): string[] {
    return this.getSessionUtrs(sessionId).map((p) => p.utr);
  }

  removeSession(sessionId: string): void {
    const utrs = this.sessions.get(sessionId);
    if (utrs) {
      for (const pending of utrs) {
        // Only remove from reverse index if this session still owns it
        if (this.reverseIndex.get(pending.utr) === sessionId) {
          this.reverseIndex.delete(pending.utr);
        }
      }
    }
    this.sessions.delete(sessionId);
  }
}

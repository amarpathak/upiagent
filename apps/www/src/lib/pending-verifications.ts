/**
 * Pending Verifications Store
 *
 * Tracks payments that are waiting to be verified via Gmail push.
 * When Gmail pushes a notification, we look up all pending payments
 * for that merchant and try to match the incoming email against each one.
 */

export interface PendingVerification {
  txnId: string;
  expectedAmount: number;
  merchantUpiId: string;
  createdAt: number;
}

// txnId → PendingVerification
const pending = new Map<string, PendingVerification>();

// merchantUpiId → Set<txnId> (for fast lookup when push arrives)
const byMerchant = new Map<string, Set<string>>();

const TTL_MS = 10 * 60 * 1000; // 10 minutes

export function addPending(v: PendingVerification): void {
  pending.set(v.txnId, v);
  const set = byMerchant.get(v.merchantUpiId) ?? new Set();
  set.add(v.txnId);
  byMerchant.set(v.merchantUpiId, set);
}

export function removePending(txnId: string): void {
  const v = pending.get(txnId);
  if (!v) return;
  pending.delete(txnId);
  const set = byMerchant.get(v.merchantUpiId);
  if (set) {
    set.delete(txnId);
    if (set.size === 0) byMerchant.delete(v.merchantUpiId);
  }
}

export function getPendingForMerchant(merchantUpiId: string): PendingVerification[] {
  const set = byMerchant.get(merchantUpiId) ?? new Set();
  return Array.from(set)
    .map((id) => pending.get(id))
    .filter((v): v is PendingVerification => !!v);
}

export function getPending(txnId: string): PendingVerification | undefined {
  return pending.get(txnId);
}

// Cleanup expired entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [txnId, v] of pending) {
    if (now - v.createdAt > TTL_MS) removePending(txnId);
  }
}, 2 * 60 * 1000);

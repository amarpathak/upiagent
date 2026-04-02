/**
 * SSE Stream Manager
 *
 * Holds a map of txnId → ReadableStreamDefaultController so that when a
 * payment is verified (via Gmail push), we can push the result directly
 * to the connected browser without any polling.
 */

type SSEController = ReadableStreamDefaultController<Uint8Array>;

const streams = new Map<string, SSEController>();

export function registerStream(txnId: string, controller: SSEController): void {
  streams.set(txnId, controller);
}

export function unregisterStream(txnId: string): void {
  streams.delete(txnId);
}

export function pushToStream(txnId: string, event: string, data: unknown): boolean {
  const controller = streams.get(txnId);
  if (!controller) return false;

  const encoder = new TextEncoder();
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  try {
    controller.enqueue(encoder.encode(msg));
    return true;
  } catch {
    // Stream already closed
    streams.delete(txnId);
    return false;
  }
}

export function closeStream(txnId: string): void {
  const controller = streams.get(txnId);
  if (!controller) return;
  try { controller.close(); } catch { /* already closed */ }
  streams.delete(txnId);
}

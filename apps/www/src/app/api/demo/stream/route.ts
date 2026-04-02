/**
 * GET /api/demo/stream?txnId=xxx
 *
 * SSE endpoint. Frontend opens this once after getting the QR code.
 * Stays open until payment is verified or times out.
 *
 * Events:
 *   connected   — stream is open and listening
 *   heartbeat   — keep-alive every 30s
 *   verified    — payment confirmed (includes payment data)
 *   expired     — timed out, no payment found
 */
import { registerStream, unregisterStream } from "@/lib/stream-manager";
import { getPending } from "@/lib/pending-verifications";

const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
const HEARTBEAT_MS = 30 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const txnId = searchParams.get("txnId");
  // Note: SSE streams are long-lived by design — this is intentional.
  // The stream closes on payment.verified, expired (3min), or client disconnect.

  if (!txnId) {
    return new Response("Missing txnId", { status: 400 });
  }

  if (!getPending(txnId)) {
    return new Response("Unknown txnId", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      registerStream(txnId, controller);

      // Send connected event immediately
      controller.enqueue(encoder.encode(`event: connected\ndata: {"txnId":"${txnId}"}\n\n`));

      // Heartbeat — keeps the connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: heartbeat\ndata: {}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_MS);

      // Timeout — close stream if no payment detected within 3 min
      const timeout = setTimeout(() => {
        clearInterval(heartbeat);
        try {
          controller.enqueue(encoder.encode(`event: expired\ndata: {"txnId":"${txnId}"}\n\n`));
          controller.close();
        } catch { /* already closed */ }
        unregisterStream(txnId);
      }, TIMEOUT_MS);

      // Cleanup when client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        clearTimeout(timeout);
        unregisterStream(txnId);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

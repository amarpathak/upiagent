/**
 * GET /api/demo/stream?txnId=xxx
 *
 * SSE endpoint. Frontend opens this once after getting the QR code.
 * Polls Supabase every 3s for payment status changes.
 * Stays open until payment is verified or times out.
 *
 * Events:
 *   connected   — stream is open and listening
 *   heartbeat   — keep-alive every 30s
 *   verified    — payment confirmed (includes payment data)
 *   expired     — timed out, no payment found
 */
import { getSupabase } from "@/lib/supabase";

const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
const HEARTBEAT_MS = 30 * 1000;
const POLL_MS = 3 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const txnId = searchParams.get("txnId");

  if (!txnId) {
    return new Response("Missing txnId", { status: 400 });
  }

  // Verify the txnId exists in Supabase
  const supabase = getSupabase();
  const { data: payment } = await supabase
    .from("payments")
    .select("status")
    .eq("transaction_id", txnId)
    .single();

  if (!payment) {
    return new Response("Unknown txnId", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      function send(event: string, data: unknown) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      }

      function cleanup() {
        closed = true;
        clearInterval(poller);
        clearInterval(heartbeat);
        clearTimeout(timeout);
      }

      // Send connected event immediately
      send("connected", { txnId });

      // Poll Supabase for payment status
      const poller = setInterval(async () => {
        if (closed) return;
        try {
          const { data: row } = await getSupabase()
            .from("payments")
            .select("status, upi_reference_id, sender_name, bank_name, overall_confidence, amount_with_paisa")
            .eq("transaction_id", txnId)
            .single();

          if (row?.status === "verified") {
            send("verified", {
              txnId,
              payment: {
                amount: row.amount_with_paisa,
                upiReferenceId: row.upi_reference_id || "",
                senderName: row.sender_name || "",
                bankName: row.bank_name || "",
              },
              confidence: row.overall_confidence || 0,
            });
            cleanup();
            try { controller.close(); } catch { /* already closed */ }
          }
        } catch {
          // Supabase query failed — will retry next interval
        }
      }, POLL_MS);

      // Heartbeat — keeps the connection alive through proxies
      const heartbeat = setInterval(() => {
        send("heartbeat", {});
      }, HEARTBEAT_MS);

      // Timeout — close stream if no payment detected within 3 min
      const timeout = setTimeout(() => {
        send("expired", { txnId });
        cleanup();
        try { controller.close(); } catch { /* already closed */ }
      }, TIMEOUT_MS);

      // Cleanup when client disconnects
      req.signal.addEventListener("abort", () => {
        cleanup();
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

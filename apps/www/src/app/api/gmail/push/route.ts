/**
 * POST /api/gmail/push
 *
 * Google Cloud Pub/Sub pushes here when a new email arrives in the watched inbox.
 * We decode the notification, fetch new emails via historyId delta-sync,
 * match against pending payments in Supabase, and update the payment row
 * so the SSE stream (which polls Supabase) picks it up.
 *
 * Setup required (one-time):
 *   1. Create a Pub/Sub topic in Google Cloud Console
 *   2. Grant roles/pubsub.publisher to gmail-api-push@system.gserviceaccount.com on that topic
 *   3. Create a push subscription pointing to https://yourdomain.com/api/gmail/push
 *   4. Set PUBSUB_TOPIC_NAME=projects/YOUR_PROJECT/topics/YOUR_TOPIC in env
 *   5. Call GmailClient.watch(topicName) once per merchant to activate
 */
import { createClient } from "@supabase/supabase-js";
import { GmailClient, decrypt, isEncrypted, verifyPayment } from "@upiagent/core";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const DEMO_UPI_ID = process.env.DEMO_UPI_ID || "demo@ybl";
function getLlmApiKey() {
  return process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || "";
}

export async function POST(req: Request) {
  try {
    return await handlePush(req);
  } catch (err) {
    console.error("[gmail/push] UNHANDLED ERROR:", err instanceof Error ? err.stack : err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal error",
        _debug_key_prefix: (process.env.GEMINI_API_KEY || "").substring(0, 10),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

async function handlePush(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  // Pub/Sub message envelope
  // { message: { data: base64, messageId, publishTime }, subscription }
  const message = (body as { message?: { data?: string } }).message;
  if (!message?.data) {
    return new Response("ok"); // Ack empty messages
  }

  let notification: { emailAddress?: string; historyId?: string };
  try {
    const decoded = Buffer.from(message.data, "base64").toString("utf-8");
    notification = JSON.parse(decoded);
  } catch {
    console.error("[gmail/push] Failed to decode Pub/Sub message");
    return new Response("ok"); // Ack to avoid re-delivery loop
  }

  const { emailAddress, historyId } = notification;
  if (!emailAddress || !historyId) {
    return new Response("ok");
  }

  console.log(`[gmail/push] Notification for ${emailAddress}, historyId: ${historyId}`);

  const supabase = getSupabase();

  // Load merchant credentials
  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, upi_id, gmail_client_id, gmail_client_secret, gmail_refresh_token, llm_api_key")
    .eq("upi_id", DEMO_UPI_ID)
    .not("gmail_refresh_token", "is", null)
    .limit(1)
    .single();

  if (!merchant?.gmail_refresh_token) {
    console.error("[gmail/push] Demo merchant not configured");
    return new Response("ok");
  }

  let clientSecret: string;
  let refreshToken: string;
  let llmKey: string;

  try {
    const encKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
    clientSecret = encKey && isEncrypted(merchant.gmail_client_secret)
      ? decrypt(merchant.gmail_client_secret, encKey)
      : merchant.gmail_client_secret;
    refreshToken = encKey && isEncrypted(merchant.gmail_refresh_token)
      ? decrypt(merchant.gmail_refresh_token, encKey)
      : merchant.gmail_refresh_token;
    llmKey = (encKey && merchant.llm_api_key && isEncrypted(merchant.llm_api_key)
      ? decrypt(merchant.llm_api_key, encKey)
      : merchant.llm_api_key) || getLlmApiKey();
  } catch (err) {
    console.error("[gmail/push] Decryption failed — check CREDENTIALS_ENCRYPTION_KEY:", err instanceof Error ? err.message : err);
    return new Response("ok");
  }

  if (!llmKey) {
    console.error("[gmail/push] No LLM key configured");
    return new Response("ok");
  }

  // Check pending payments in Supabase (not in-memory — works across instances)
  const { data: pendingPayments } = await supabase
    .from("payments")
    .select("transaction_id, amount_with_paisa")
    .eq("merchant_id", merchant.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString());

  if (!pendingPayments || pendingPayments.length === 0) {
    console.log("[gmail/push] No pending verifications for merchant, ignoring");
    return new Response("ok");
  }

  // Fetch only new emails since historyId
  const gmailClient = new GmailClient({
    clientId: merchant.gmail_client_id || process.env.GMAIL_CLIENT_ID!,
    clientSecret,
    refreshToken,
  });

  let newEmails;
  try {
    newEmails = await gmailClient.fetchSinceHistory(historyId);
  } catch (err) {
    console.error("[gmail/push] fetchSinceHistory failed:", err instanceof Error ? err.message : err);
    return new Response("ok");
  }

  if (newEmails.length === 0) {
    console.log("[gmail/push] No new bank alert emails in this push");
    return new Response("ok");
  }

  console.log(`[gmail/push] ${newEmails.length} new email(s), ${pendingPayments.length} pending verification(s)`);

  // Try each pending verification against each new email
  for (const pending of pendingPayments) {
    for (const email of newEmails) {
      const result = await verifyPayment(email, {
        llm: { provider: "gemini", model: "gemini-2.5-flash-lite", apiKey: llmKey },
        expected: { amount: pending.amount_with_paisa, timeWindowMinutes: 30 },
        preset: "demo",
      });

      if (result.verified && result.payment) {
        console.log(`[gmail/push] ✓ Verified ${pending.transaction_id} — ₹${result.payment.amount}`);

        // Update payment in Supabase — the SSE stream will pick this up
        await supabase
          .from("payments")
          .update({
            status: "verified",
            upi_reference_id: result.payment.upiReferenceId,
            sender_name: result.payment.senderName,
            bank_name: result.payment.bankName,
            overall_confidence: result.confidence,
            verified_at: new Date().toISOString(),
          })
          .eq("transaction_id", pending.transaction_id)
          .eq("status", "pending"); // atomic — only update if still pending

        break;
      }
    }
  }

  return new Response("ok");
}

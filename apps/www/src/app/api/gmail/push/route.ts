/**
 * POST /api/gmail/push
 *
 * Google Cloud Pub/Sub pushes here when a new email arrives in the watched inbox.
 * We decode the notification, fetch new emails via historyId delta-sync,
 * try to match against pending verifications, and push results via SSE.
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
import { getPendingForMerchant, removePending } from "@/lib/pending-verifications";
import { pushToStream, closeStream } from "@/lib/stream-manager";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const DEMO_UPI_ID = process.env.DEMO_UPI_ID || "demo@ybl";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export async function POST(req: Request) {
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

  // Load merchant credentials
  const { data: merchant } = await getSupabase()
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

  const encKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  const clientSecret = encKey && isEncrypted(merchant.gmail_client_secret)
    ? decrypt(merchant.gmail_client_secret, encKey)
    : merchant.gmail_client_secret;
  const refreshToken = encKey && isEncrypted(merchant.gmail_refresh_token)
    ? decrypt(merchant.gmail_refresh_token, encKey)
    : merchant.gmail_refresh_token;
  const llmKey = (encKey && merchant.llm_api_key && isEncrypted(merchant.llm_api_key)
    ? decrypt(merchant.llm_api_key, encKey)
    : merchant.llm_api_key) || GEMINI_API_KEY;

  if (!llmKey) {
    console.error("[gmail/push] No LLM key configured");
    return new Response("ok");
  }

  // Check if we have anything pending for this merchant
  const pendingList = getPendingForMerchant(merchant.upi_id);
  if (pendingList.length === 0) {
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

  console.log(`[gmail/push] ${newEmails.length} new email(s), ${pendingList.length} pending verification(s)`);

  // Try each pending verification against each new email
  for (const pending of pendingList) {
    for (const email of newEmails) {
      const result = await verifyPayment(email, {
        llm: { provider: "gemini", model: "gemini-2.0-flash-lite", apiKey: llmKey },
        expected: { amount: pending.expectedAmount, timeWindowMinutes: 30 },
        preset: "demo",
      });

      if (result.verified && result.payment) {
        console.log(`[gmail/push] ✓ Verified ${pending.txnId} — ₹${result.payment.amount}`);
        removePending(pending.txnId);
        pushToStream(pending.txnId, "verified", {
          txnId: pending.txnId,
          payment: result.payment,
          confidence: result.confidence,
        });
        closeStream(pending.txnId);
        break;
      }
    }
  }

  return new Response("ok");
}

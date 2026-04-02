/**
 * GET /api/demo/debug
 *
 * Temporary diagnostic endpoint to verify the Gmail watch + Pub/Sub pipeline.
 * Returns the status of each step. Remove after debugging.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GmailClient, decrypt, isEncrypted } from "@upiagent/core";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const DEMO_UPI_ID = process.env.DEMO_UPI_ID || "demo@ybl";
const PUBSUB_TOPIC_NAME = process.env.PUBSUB_TOPIC_NAME || "";

export async function GET() {
  const results: Record<string, unknown> = {};

  // Step 1: Check env vars
  results.env = {
    DEMO_UPI_ID: DEMO_UPI_ID,
    PUBSUB_TOPIC_NAME: PUBSUB_TOPIC_NAME || "NOT SET",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "set (" + process.env.GEMINI_API_KEY.substring(0, 8) + "...)" : "NOT SET",
    GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID ? "set" : "NOT SET",
    CREDENTIALS_ENCRYPTION_KEY: process.env.CREDENTIALS_ENCRYPTION_KEY ? "set" : "NOT SET",
  };

  // Step 2: Check merchant in DB
  const supabase = getSupabase();
  const { data: merchant, error: merchantErr } = await supabase
    .from("merchants")
    .select("id, upi_id, gmail_client_id, gmail_client_secret, gmail_refresh_token")
    .eq("upi_id", DEMO_UPI_ID)
    .not("gmail_refresh_token", "is", null)
    .limit(1)
    .single();

  if (merchantErr) {
    results.merchant = { error: merchantErr.message };
    return NextResponse.json(results);
  }

  results.merchant = {
    id: merchant.id,
    upi_id: merchant.upi_id,
    has_client_id: !!merchant.gmail_client_id,
    has_client_secret: !!merchant.gmail_client_secret,
    has_refresh_token: !!merchant.gmail_refresh_token,
    secret_encrypted: isEncrypted(merchant.gmail_client_secret),
    token_encrypted: isEncrypted(merchant.gmail_refresh_token),
  };

  // Step 3: Decrypt
  try {
    const encKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
    const clientSecret = encKey && isEncrypted(merchant.gmail_client_secret)
      ? decrypt(merchant.gmail_client_secret, encKey)
      : merchant.gmail_client_secret;
    const refreshToken = encKey && isEncrypted(merchant.gmail_refresh_token)
      ? decrypt(merchant.gmail_refresh_token, encKey)
      : merchant.gmail_refresh_token;

    results.decrypt = { success: true };

    // Step 4: Gmail watch
    const gmailClient = new GmailClient({
      clientId: merchant.gmail_client_id || process.env.GMAIL_CLIENT_ID!,
      clientSecret,
      refreshToken,
    });

    try {
      const watchResult = await gmailClient.watch(PUBSUB_TOPIC_NAME);
      results.watch = { success: true, historyId: watchResult.historyId, expiration: watchResult.expiration };
    } catch (watchErr) {
      results.watch = { success: false, error: watchErr instanceof Error ? watchErr.message : String(watchErr) };
    }
  } catch (decryptErr) {
    results.decrypt = { success: false, error: decryptErr instanceof Error ? decryptErr.message : String(decryptErr) };
  }

  // Step 5: Pending payments
  const { data: pending } = await supabase
    .from("payments")
    .select("transaction_id, amount_with_paisa, expires_at")
    .eq("merchant_id", merchant.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString());

  results.pending = pending || [];

  return NextResponse.json(results, { headers: { "Cache-Control": "no-store" } });
}

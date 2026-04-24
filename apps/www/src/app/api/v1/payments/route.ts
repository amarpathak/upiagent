// apps/www/src/app/api/v1/payments/route.ts
import { NextResponse } from "next/server";
import { createPayment, GmailClient, decrypt, isEncrypted } from "@upiagent/core";
import { authenticateApiKey } from "@/lib/api-auth";
import { getSupabase } from "@/lib/supabase";

const PUBSUB_TOPIC_NAME = process.env.PUBSUB_TOPIC_NAME || "";

// Per-merchant rate limiting (30 req/min)
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const merchantHits = new Map<string, { count: number; resetAt: number }>();

function isMerchantRateLimited(merchantId: string): boolean {
  const now = Date.now();
  const entry = merchantHits.get(merchantId);
  if (!entry || now > entry.resetAt) {
    merchantHits.set(merchantId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of merchantHits) {
    if (now > entry.resetAt) merchantHits.delete(key);
  }
}, 5 * 60_000);

export async function POST(req: Request) {
  // Authenticate
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { merchant } = auth;

  // Rate limit
  if (isMerchantRateLimited(merchant.id)) {
    return NextResponse.json(
      { error: "Too many requests. Max 30 payments/minute." },
      { status: 429 },
    );
  }

  // Parse body
  let body: { amount?: number; note?: string; addPaisa?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { amount, note, addPaisa } = body;

  if (!amount || typeof amount !== "number" || amount < 1 || amount > 100000) {
    return NextResponse.json(
      { error: "amount is required and must be between 1 and 100000" },
      { status: 400 },
    );
  }

  // Create payment via core
  const payment = await createPayment(
    { upiId: merchant.upi_id, name: merchant.display_name || merchant.name },
    { amount, note, addPaisa, transactionId: `TXN_${merchant.id.substring(0, 6)}_${Date.now().toString(36)}` },
  );

  const supabase = getSupabase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Insert payment row
  const { data: row, error: insertErr } = await supabase
    .from("payments")
    .insert({
      merchant_id: merchant.id,
      transaction_id: payment.transactionId,
      amount,
      amount_with_paisa: payment.amount,
      note: note || null,
      status: "pending",
      intent_url: payment.intentUrl,
      qr_data_url: payment.qrDataUrl,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    console.error("[api/v1/payments] Failed to insert payment:", insertErr?.message);
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
  }

  // Start Gmail watch (fire-and-forget) if merchant has Gmail configured
  if (PUBSUB_TOPIC_NAME && merchant.gmail_refresh_token) {
    try {
      const encKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
      const clientSecret =
        encKey && isEncrypted(merchant.gmail_client_secret!)
          ? decrypt(merchant.gmail_client_secret!, encKey)
          : merchant.gmail_client_secret!;
      const refreshToken =
        encKey && isEncrypted(merchant.gmail_refresh_token)
          ? decrypt(merchant.gmail_refresh_token, encKey)
          : merchant.gmail_refresh_token;

      const gmailClient = new GmailClient({
        clientId: merchant.gmail_client_id || process.env.GMAIL_CLIENT_ID!,
        clientSecret,
        refreshToken,
      });

      await gmailClient.watch(PUBSUB_TOPIC_NAME);
    } catch (err) {
      console.error("[api/v1/payments] Gmail watch failed:", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({
    id: row.id,
    transactionId: payment.transactionId,
    amount: payment.amount,
    intentUrl: payment.intentUrl,
    qrDataUrl: payment.qrDataUrl,
    status: "pending",
    expiresAt,
  }, { status: 201 });
}

// apps/www/src/app/api/demo/route.ts
import { NextResponse } from "next/server";
import { createPayment, GmailClient, decrypt, isEncrypted } from "@upiagent/core";
import { getSupabase } from "@/lib/supabase";

const DEMO_UPI_ID = process.env.DEMO_UPI_ID || "demo@ybl";
const PUBSUB_TOPIC_NAME = process.env.PUBSUB_TOPIC_NAME || "";

const RATE_WINDOW_MS = 60_000;
const PER_IP_MAX = 5;
const GLOBAL_MAX = 50;
const ipHits = new Map<string, { count: number; resetAt: number }>();
const globalHits = { count: 0, resetAt: Date.now() + RATE_WINDOW_MS };

function isDemoRateLimited(ip: string): boolean {
  const now = Date.now();
  if (now > globalHits.resetAt) {
    globalHits.count = 0;
    globalHits.resetAt = now + RATE_WINDOW_MS;
  }
  globalHits.count++;
  if (globalHits.count > GLOBAL_MAX) return true;

  const entry = ipHits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > PER_IP_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of ipHits) {
    if (now > entry.resetAt) ipHits.delete(key);
  }
}, 5 * 60_000);

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (isDemoRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429 },
    );
  }

  const { amount, upiId, merchantName, note, addPaisa } = await req.json();

  if (!amount || amount < 1 || amount > 100000) {
    return NextResponse.json(
      { error: "Amount must be between 1 and 100000" },
      { status: 400 },
    );
  }

  const effectiveUpiId = upiId || DEMO_UPI_ID;
  const supabase = getSupabase();

  const payment = await createPayment(
    { upiId: effectiveUpiId, name: merchantName || "upiagent demo" },
    { amount: Number(amount), note, addPaisa, transactionId: `TXN_DEMO_${Date.now()}` },
  );

  // Look up demo merchant for both the payment insert and Gmail watch
  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, gmail_client_id, gmail_client_secret, gmail_refresh_token")
    .eq("upi_id", DEMO_UPI_ID)
    .not("gmail_refresh_token", "is", null)
    .limit(1)
    .single();

  // Store pending payment in Supabase — shared across all serverless instances
  if (merchant) {
    const { error: insertErr } = await supabase.from("payments").insert({
      merchant_id: merchant.id,
      transaction_id: payment.transactionId,
      amount: Number(amount),
      amount_with_paisa: payment.amount,
      note,
      status: "pending",
      intent_url: payment.intentUrl,
      qr_data_url: payment.qrDataUrl,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (insertErr) {
      console.error("[demo] Failed to insert payment:", insertErr.message);
    }
  }

  // Start Gmail watch so Google notifies us when an email arrives
  if (PUBSUB_TOPIC_NAME && merchant?.gmail_refresh_token) {
    try {
      const encKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
      const clientSecret =
        encKey && isEncrypted(merchant.gmail_client_secret)
          ? decrypt(merchant.gmail_client_secret, encKey)
          : merchant.gmail_client_secret;
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
      console.log(`[demo] Gmail watch started for ${payment.transactionId}`);
    } catch (err) {
      console.error("[demo] Failed to start Gmail watch:", err instanceof Error ? err.message : err);
    }
  } else if (!PUBSUB_TOPIC_NAME) {
    console.warn("[demo] PUBSUB_TOPIC_NAME not set — Gmail push notifications disabled");
  }

  return NextResponse.json({
    qrDataUrl: payment.qrDataUrl,
    intentUrl: payment.intentUrl,
    amount: payment.amount,
    transactionId: payment.transactionId,
  });
}

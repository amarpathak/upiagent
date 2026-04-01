import { NextResponse } from "next/server";
import { createPayment } from "@upiagent/core";

// ── Rate limiting (5 req/min per IP, 50/min global) ─────
const RATE_WINDOW_MS = 60_000;
const PER_IP_MAX = 5;
const GLOBAL_MAX = 50;
const ipHits = new Map<string, { count: number; resetAt: number }>();
const globalHits = { count: 0, resetAt: Date.now() + RATE_WINDOW_MS };

function isDemoRateLimited(ip: string): boolean {
  const now = Date.now();

  // Global limit
  if (now > globalHits.resetAt) {
    globalHits.count = 0;
    globalHits.resetAt = now + RATE_WINDOW_MS;
  }
  globalHits.count++;
  if (globalHits.count > GLOBAL_MAX) return true;

  // Per-IP limit
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
  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isDemoRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429 },
    );
  }

  const { amount, upiId, merchantName, note, addPaisa } = await req.json();

  if (!amount || amount < 1 || amount > 100000) {
    return NextResponse.json({ error: "Amount must be between 1 and 100000" }, { status: 400 });
  }

  const payment = await createPayment(
    {
      upiId: upiId || process.env.DEMO_UPI_ID || "demo@ybl",
      name: merchantName || "upiagent demo",
    },
    {
      amount: Number(amount),
      note,
      addPaisa,
      transactionId: `TXN_DEMO_${Date.now()}`,
    },
  );

  return NextResponse.json({
    qrDataUrl: payment.qrDataUrl,
    intentUrl: payment.intentUrl,
    amount: payment.amount,
    transactionId: payment.transactionId,
  });
}

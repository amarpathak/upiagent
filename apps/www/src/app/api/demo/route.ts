// apps/www/src/app/api/demo/route.ts
import { NextResponse, after } from "next/server";
import { createPayment } from "@upiagent/core";
import { runDemoVerification } from "@/lib/demo-verify";

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

  // Trigger background verification — runs after response is sent
  after(async () => {
    await runDemoVerification(payment.transactionId, payment.amount);
  });

  return NextResponse.json({
    qrDataUrl: payment.qrDataUrl,
    intentUrl: payment.intentUrl,
    amount: payment.amount,
    transactionId: payment.transactionId,
  });
}

import QRCode from "qrcode";
import { NextResponse } from "next/server";

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
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
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

  // Add random paisa for unique amount matching
  let finalAmount = Number(amount);
  if (addPaisa) {
    const paisa = Math.floor(Math.random() * 99 + 1) / 100;
    finalAmount = Math.floor(finalAmount) + paisa;
  }

  const txnId = `TXN_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

  const params = new URLSearchParams();
  params.set("pa", upiId || "amarpathakhdfc@ybl");
  params.set("pn", merchantName || "upiagent demo");
  params.set("am", finalAmount.toFixed(2));
  params.set("tr", txnId);
  params.set("cu", "INR");
  if (note) params.set("tn", note);

  const intentUrl = `upi://pay?${params.toString().replace(/\+/g, "%20")}`;

  const qrDataUrl = await QRCode.toDataURL(intentUrl, {
    width: 280,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#fafafa", light: "#18181b" },
  });

  return NextResponse.json({
    qrDataUrl,
    intentUrl,
    amount: finalAmount,
    transactionId: txnId,
  });
}

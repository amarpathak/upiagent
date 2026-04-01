import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@upiagent/core";

const webhookResults = new Map<string, { payload: unknown; expiresAt: number }>();
const TTL_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of webhookResults) {
    if (now > entry.expiresAt) webhookResults.delete(key);
  }
}, 60_000);

const DEMO_WEBHOOK_SECRET = process.env.DEMO_WEBHOOK_SECRET || "0".repeat(64);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-upiagent-signature") || "";

  if (!verifyWebhookSignature(body, signature, DEMO_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);
  const paymentId = payload.data?.paymentId;

  if (!paymentId) {
    return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });
  }

  webhookResults.set(paymentId, {
    payload,
    expiresAt: Date.now() + TTL_MS,
  });

  return NextResponse.json({ received: true });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const paymentId = url.searchParams.get("paymentId");

  if (!paymentId) {
    return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });
  }

  const entry = webhookResults.get(paymentId);

  if (!entry || Date.now() > entry.expiresAt) {
    return NextResponse.json({ received: false });
  }

  webhookResults.delete(paymentId);
  return NextResponse.json({ received: true, payload: entry.payload });
}

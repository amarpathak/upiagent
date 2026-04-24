import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@upiagent/core";
import { getSupabase } from "@/lib/supabase";

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

  // Update payment in Supabase if the webhook carries verification data
  if (payload.event === "payment.verified" && payload.data) {
    const d = payload.data;
    await getSupabase()
      .from("payments")
      .update({
        status: "verified",
        upi_reference_id: d.upiReferenceId,
        sender_name: d.senderName,
        bank_name: d.bankName,
        overall_confidence: d.confidence,
        verified_at: d.verifiedAt || new Date().toISOString(),
      })
      .eq("transaction_id", paymentId)
      .eq("status", "pending");
  }

  return NextResponse.json({ received: true });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const paymentId = url.searchParams.get("paymentId");

  if (!paymentId) {
    return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });
  }

  const { data: payment } = await getSupabase()
    .from("payments")
    .select("status, upi_reference_id, sender_name, bank_name, overall_confidence, amount_with_paisa, verified_at")
    .eq("transaction_id", paymentId)
    .single();

  if (!payment) {
    return NextResponse.json({ received: false });
  }

  if (payment.status === "verified") {
    return NextResponse.json({
      received: true,
      payload: {
        event: "payment.verified",
        data: {
          paymentId,
          amount: payment.amount_with_paisa,
          upiReferenceId: payment.upi_reference_id,
          senderName: payment.sender_name,
          bankName: payment.bank_name,
          confidence: payment.overall_confidence,
          verifiedAt: payment.verified_at,
        },
      },
    });
  }

  return NextResponse.json({ received: false });
}

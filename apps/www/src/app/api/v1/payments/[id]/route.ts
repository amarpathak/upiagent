import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { getSupabase } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Authenticate
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid payment ID format" }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data: payment, error } = await supabase
    .from("payments")
    .select("id, transaction_id, amount, amount_with_paisa, note, status, intent_url, qr_data_url, expires_at, upi_reference_id, sender_name, sender_upi_id, bank_name, verification_source, overall_confidence, created_at, verified_at, merchant_id")
    .eq("id", id)
    .single();

  if (error || !payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // Ensure payment belongs to this merchant
  if (payment.merchant_id !== auth.merchant.id) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // Check expiry — mark expired if past due and still pending
  if (payment.status === "pending" && payment.expires_at && new Date(payment.expires_at) < new Date()) {
    await supabase
      .from("payments")
      .update({ status: "expired" })
      .eq("id", id)
      .eq("status", "pending");
    payment.status = "expired";
  }

  // Build response (exclude merchant_id from public API)
  const response: Record<string, unknown> = {
    id: payment.id,
    transactionId: payment.transaction_id,
    amount: payment.amount_with_paisa ?? payment.amount,
    note: payment.note,
    status: payment.status,
    intentUrl: payment.intent_url,
    qrDataUrl: payment.qr_data_url,
    expiresAt: payment.expires_at,
    createdAt: payment.created_at,
  };

  if (payment.status === "verified") {
    response.upiReferenceId = payment.upi_reference_id;
    response.senderName = payment.sender_name;
    response.senderUpiId = payment.sender_upi_id;
    response.bankName = payment.bank_name;
    response.confidence = payment.overall_confidence;
    response.verifiedAt = payment.verified_at;
  }

  return NextResponse.json(response);
}

import { NextResponse } from "next/server";
import {
  fetchAndVerifyPayment,
  decrypt,
  isEncrypted,
  CostTracker,
  StepLogger,
  type LlmProvider,
} from "@upiagent/core";
import { authenticateApiKey } from "@/lib/api-auth";
import { getSupabase } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

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

/**
 * POST /api/v1/payments/:id — Trigger verification
 *
 * Actively checks Gmail for a matching bank alert and verifies the payment.
 * Call this after the customer has paid to trigger immediate verification
 * instead of waiting for Gmail push notifications.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { merchant } = auth;
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid payment ID format" }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data: payment } = await supabase
    .from("payments")
    .select("id, transaction_id, amount, amount_with_paisa, status, merchant_id, created_at")
    .eq("id", id)
    .single();

  if (!payment || payment.merchant_id !== merchant.id) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  if (payment.status === "verified") {
    return NextResponse.json({ verified: true, status: "verified", message: "Already verified" });
  }

  if (payment.status !== "pending") {
    return NextResponse.json({ verified: false, status: payment.status });
  }

  // Check Gmail credentials
  if (!merchant.gmail_refresh_token || !merchant.gmail_client_id || !merchant.gmail_client_secret) {
    return NextResponse.json(
      { error: "Gmail not connected. Connect Gmail in dashboard settings." },
      { status: 400 },
    );
  }

  // Decrypt credentials
  const encKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  let clientSecret: string;
  let refreshToken: string;

  try {
    clientSecret = encKey && isEncrypted(merchant.gmail_client_secret)
      ? decrypt(merchant.gmail_client_secret, encKey)
      : merchant.gmail_client_secret;
    refreshToken = encKey && isEncrypted(merchant.gmail_refresh_token)
      ? decrypt(merchant.gmail_refresh_token, encKey)
      : merchant.gmail_refresh_token;
  } catch {
    return NextResponse.json({ error: "Failed to decrypt credentials" }, { status: 500 });
  }

  // Decrypt LLM key
  const llmKeyRaw = encKey && merchant.llm_api_key && isEncrypted(merchant.llm_api_key)
    ? decrypt(merchant.llm_api_key, encKey)
    : merchant.llm_api_key;
  const llmApiKey = llmKeyRaw || GEMINI_API_KEY;

  if (!llmApiKey) {
    return NextResponse.json(
      { error: "No LLM API key configured" },
      { status: 400 },
    );
  }

  const expectedAmount = Number(payment.amount_with_paisa ?? payment.amount);

  try {
    const costTracker = new CostTracker();
    const stepLogger = new StepLogger();

    const result = await fetchAndVerifyPayment({
      gmail: {
        clientId: merchant.gmail_client_id || process.env.GMAIL_CLIENT_ID!,
        clientSecret,
        refreshToken,
      },
      llm: {
        provider: (merchant.llm_provider ?? "anthropic") as LlmProvider,
        model: merchant.llm_model ?? "claude-haiku-4-5-20251001",
        apiKey: llmApiKey,
      },
      expected: {
        amount: expectedAmount,
        timeWindowMinutes: 60,
      },
      lookbackMinutes: 60,
      maxEmails: 10,
      costTracker,
      stepLogger,
    });

    if (result.verified && result.payment) {
      // Update payment
      await supabase
        .from("payments")
        .update({
          status: "verified",
          verification_source: "gmail",
          overall_confidence: result.confidence,
          upi_reference_id: result.payment.upiReferenceId,
          sender_name: result.payment.senderName,
          bank_name: result.payment.bankName,
          verified_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "pending");

      return NextResponse.json({
        verified: true,
        status: "verified",
        payment: {
          amount: result.payment.amount,
          upiReferenceId: result.payment.upiReferenceId,
          senderName: result.payment.senderName,
          bankName: result.payment.bankName,
          confidence: result.confidence,
        },
      });
    }

    return NextResponse.json({
      verified: false,
      status: "pending",
      message: result.failureDetails ?? `No matching payment found for amount ${expectedAmount}`,
    });
  } catch (error) {
    console.error("[api/v1/payments/verify] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed" },
      { status: 500 },
    );
  }
}

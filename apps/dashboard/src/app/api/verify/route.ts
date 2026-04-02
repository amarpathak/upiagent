import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchAndVerifyPayment,
  decrypt,
  isEncrypted,
  type LlmProvider,
  WebhookSender,
  CostTracker,
  LlmRateLimiter,
  type WebhookPayload,
} from "@upiagent/core";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

// UUID v4 format validation (M3)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Per-user rate limiting (10 req/min) ──────────────────
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const userHits = new Map<string, { count: number; resetAt: number }>();

function isUserRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = userHits.get(userId);
  if (!entry || now > entry.resetAt) {
    userHits.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of userHits) {
    if (now > entry.resetAt) userHits.delete(key);
  }
}, 5 * 60_000);

// Lazy-init: avoid module-level createClient which crashes the build
// when env vars aren't available at static-analysis time.
function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const webhookSender = new WebhookSender();

// Per-merchant rate limiter — shared across all merchants on this instance
// Production should use a distributed limiter (Redis)
const llmRateLimiter = new LlmRateLimiter({
  maxCallsPerMinute: 20,
  maxCallsPerHour: 200,
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

/**
 * POST /api/verify
 * Body: { paymentId: string }
 *
 * Verifies a pending payment by checking Gmail for matching bank alert.
 * Called by the payment detail page to poll for verification.
 */
export async function POST(req: Request) {
  const supabase = getServiceSupabase();
  // C2: Authenticate the caller
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Rate limit: 10 verify requests/min per user
  if (isUserRateLimited(user.id)) {
    return NextResponse.json(
      { error: "Too many verification requests. Please wait before retrying." },
      { status: 429 },
    );
  }

  const { paymentId, force, seenMessageIds: seenArr } = await req.json();
  const skipMessageIds = Array.isArray(seenArr) ? new Set<string>(seenArr) : undefined;

  if (!paymentId) {
    return NextResponse.json({ error: "paymentId required" }, { status: 400 });
  }

  // M3: Validate UUID format
  if (!UUID_RE.test(paymentId)) {
    return NextResponse.json({ error: "Invalid paymentId format" }, { status: 400 });
  }

  // Get payment + merchant (include webhook columns for delivery after verification)
  const { data: payment } = await supabase
    .from("payments")
    .select("*, merchants(*, webhook_url, webhook_secret)")
    .eq("id", paymentId)
    .single();

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // C2: Verify the caller owns this payment's merchant
  const merchant = payment.merchants;
  if (!merchant || merchant.user_id !== user.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Monthly token limit enforcement
  const tokenLimit = merchant.monthly_token_limit ?? 100_000;
  if (tokenLimit > 0) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Get this merchant's payment IDs, then aggregate tokens from evidence
    const { data: merchantPayments } = await supabase
      .from("payments")
      .select("id")
      .eq("merchant_id", merchant.id);

    const paymentIds = (merchantPayments ?? []).map((p: { id: string }) => p.id);

    if (paymentIds.length > 0) {
      const { data: monthUsage } = await supabase
        .from("verification_evidence")
        .select("llm_total_tokens")
        .in("payment_id", paymentIds)
        .gte("created_at", monthStart.toISOString());

      const usedTokens = (monthUsage ?? []).reduce(
        (sum: number, e: { llm_total_tokens: number | null }) => sum + (e.llm_total_tokens ?? 0),
        0,
      );

      if (usedTokens >= tokenLimit) {
        return NextResponse.json(
          { error: "Monthly AI token limit reached. Upgrade your plan or add your own API key in Settings.", retryable: false },
          { status: 429 },
        );
      }
    }
  }

  if (payment.status !== "pending" && payment.status !== "expired" && !force) {
    return NextResponse.json({
      verified: payment.status === "verified",
      status: payment.status,
      payment,
    });
  }

  // Check if expired (skip if force=true for manual retries)
  if (!force && payment.expires_at && new Date(payment.expires_at) < new Date()) {
    await supabase
      .from("payments")
      .update({ status: "expired" })
      .eq("id", paymentId);
    return NextResponse.json({ verified: false, status: "expired" });
  }

  if (!merchant?.gmail_refresh_token || !merchant?.gmail_client_id || !merchant?.gmail_client_secret) {
    return NextResponse.json({
      verified: false,
      status: "pending",
      message: "Gmail not connected. Go to Settings to connect Gmail.",
    });
  }

  // Decrypt credentials with strict encryption checks
  const encKey = process.env.CREDENTIALS_ENCRYPTION_KEY;

  const secretEncrypted = isEncrypted(merchant.gmail_client_secret);
  const tokenEncrypted = isEncrypted(merchant.gmail_refresh_token);

  // FAIL HARD: encrypted credentials but no key to decrypt them
  if (!encKey && (secretEncrypted || tokenEncrypted)) {
    console.error("[verify] Server misconfiguration: encrypted credentials found but CREDENTIALS_ENCRYPTION_KEY is not set");
    return NextResponse.json(
      { error: "Server misconfiguration: encryption key not set" },
      { status: 500 },
    );
  }

  // Backward compat: plaintext credentials with key set (migration period)
  if (encKey && (!secretEncrypted || !tokenEncrypted)) {
    console.warn("[verify] WARNING: plaintext credentials detected with encryption key set — credentials should be re-encrypted via Settings");
  }

  // Dev/testing: plaintext credentials without key
  if (!encKey && !secretEncrypted && !tokenEncrypted) {
    console.warn("[verify] WARNING: running with plaintext credentials and no encryption key (dev/testing mode)");
  }

  const clientSecret = encKey && secretEncrypted
    ? decrypt(merchant.gmail_client_secret, encKey)
    : merchant.gmail_client_secret;
  const refreshToken = encKey && tokenEncrypted
    ? decrypt(merchant.gmail_refresh_token, encKey)
    : merchant.gmail_refresh_token;

  // Decrypt LLM API key if present
  const llmKeyEncrypted = merchant.llm_api_key && isEncrypted(merchant.llm_api_key);
  if (!encKey && llmKeyEncrypted) {
    console.error("[verify] Server misconfiguration: encrypted llm_api_key but CREDENTIALS_ENCRYPTION_KEY is not set");
    return NextResponse.json(
      { error: "Server misconfiguration: encryption key not set" },
      { status: 500 },
    );
  }
  const rawLlmKey = encKey && llmKeyEncrypted
    ? decrypt(merchant.llm_api_key, encKey)
    : merchant.llm_api_key;
  const llmApiKey = rawLlmKey || GEMINI_API_KEY;
  if (!llmApiKey) {
    return NextResponse.json({ verified: false, status: "pending", message: "No LLM API key configured" });
  }

  // H2: Lookback capped at 60 min for all requests
  const lookbackMinutes = Math.min(force ? 60 : 10, 60);
  const expectedAmount = Number(payment.amount_with_paisa ?? payment.amount);

  try {
    // Per-verification cost tracker — tracks tokens for this single request
    const costTracker = new CostTracker();

    // ── Core library handles: Gmail fetch → pre-LLM gate → rate limit →
    //    LLM parse → 5-layer security validation (format, bank source,
    //    amount, time window, dedup)
    const result = await fetchAndVerifyPayment({
      gmail: {
        clientId: merchant.gmail_client_id,
        clientSecret: clientSecret,
        refreshToken: refreshToken,
      },
      llm: {
        provider: (merchant.llm_provider ?? "gemini") as LlmProvider,
        model: merchant.llm_model ?? "gemini-flash-lite-latest",
        apiKey: llmApiKey,
      },
      expected: {
        amount: expectedAmount,
        timeWindowMinutes: 30,
      },
      lookbackMinutes,
      maxEmails: 5,
      costTracker,
      rateLimiter: llmRateLimiter,
      skipMessageIds,
    });

    // Track LLM usage per verification for billing
    const usage = costTracker.getUsage();

    // Record evidence + LLM usage for billing/dashboard
    await supabase.from("verification_evidence").insert({
      payment_id: paymentId,
      source: "gmail",
      status: result.verified ? "match" : "no_match",
      confidence: result.confidence,
      extracted_amount: result.payment?.amount ?? null,
      extracted_upi_ref: result.payment?.upiReferenceId ?? null,
      extracted_sender: result.payment?.senderName ?? null,
      extracted_bank: result.payment?.bankName ?? null,
      layer_results: Object.fromEntries(
        result.layerResults.map((lr) => [lr.layer, lr.passed]),
      ),
      llm_input_tokens: usage.inputTokens,
      llm_output_tokens: usage.outputTokens,
      llm_total_tokens: usage.totalTokens,
      llm_call_count: usage.callCount,
    });

    console.log(`[verify] Payment ${paymentId}: ${result.verified ? "verified" : "pending"}, LLM: ${usage.totalTokens} tokens, ${usage.callCount} calls`);

    if (result.verified && result.payment) {
      // VERIFIED! Conditional update to prevent TOCTOU race
      const { data: updated } = await supabase
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
        .eq("id", paymentId)
        .eq("status", "pending")
        .select();

      if (!updated || updated.length === 0) {
        return NextResponse.json({
          verified: true,
          status: "already_verified",
          message: "Payment was already verified by another request",
        });
      }

      // Fire-and-forget webhook delivery — does not block the response
      if (merchant.webhook_url && merchant.webhook_secret) {
        const payload: WebhookPayload = {
          event: "payment.verified",
          timestamp: new Date().toISOString(),
          deliveryId: `d_${randomUUID()}`,
          data: {
            paymentId,
            amount: result.payment!.amount,
            currency: "INR",
            status: "verified",
            upiReferenceId: result.payment!.upiReferenceId,
            senderName: result.payment!.senderName,
            confidence: result.confidence,
            verifiedAt: new Date().toISOString(),
          },
        };

        webhookSender.send(merchant.webhook_url, merchant.webhook_secret, payload)
          .then((dr) => {
            if (!dr.delivered) console.error(`[webhook] Failed to deliver to ${merchant.webhook_url}:`, dr.error);
          })
          .catch((err) => console.error("[webhook] Error:", err));
      }

      return NextResponse.json({
        verified: true,
        status: "verified",
        seenMessageIds: result.processedMessageIds ?? [],
        payment: {
          amount: result.payment.amount,
          upiReferenceId: result.payment.upiReferenceId,
          senderName: result.payment.senderName,
          bankName: result.payment.bankName,
          confidence: result.confidence,
        },
      });
    }

    // Not verified — return pending with reason
    return NextResponse.json({
      verified: false,
      status: "pending",
      seenMessageIds: result.processedMessageIds ?? [],
      message: result.failureDetails ?? `No matching ₹${expectedAmount} credit found`,
    });
  } catch (error) {
    console.error("[verify] Error during payment verification:", error);
    const errMsg = error instanceof Error ? error.message : "Gmail fetch error";

    // Surface quota/rate-limit errors as 429 so the client stops polling
    const isQuotaError = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("rate limit") || errMsg.includes("Too Many Requests");
    if (isQuotaError) {
      return NextResponse.json(
        { error: "LLM quota exceeded. Please wait or upgrade your API plan.", retryable: false },
        { status: 429 },
      );
    }

    return NextResponse.json({
      verified: false,
      status: "pending",
      message: errMsg,
    });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { decrypt, isEncrypted, parsePaymentEmail, type LlmConfig, type ParsedPayment } from "@upiagent/core";
import { createClient as createAuthClient } from "@/lib/supabase/server";

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

// Use service role to bypass RLS — this is a backend verification worker
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeBase64Url(data: string): string {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractBody(payload: { mimeType?: string | null; body?: { data?: string | null } | null; parts?: Array<{ mimeType?: string | null; body?: { data?: string | null } | null }> | null }): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return stripHtml(decodeBase64Url(part.body.data));
      }
    }
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return stripHtml(decodeBase64Url(payload.body.data));
  }
  return "";
}

/**
 * POST /api/verify
 * Body: { paymentId: string }
 *
 * Verifies a pending payment by checking Gmail for matching bank alert.
 * Called by the payment detail page to poll for verification.
 */
export async function POST(req: Request) {
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

  const { paymentId, force } = await req.json();

  if (!paymentId) {
    return NextResponse.json({ error: "paymentId required" }, { status: 400 });
  }

  // M3: Validate UUID format
  if (!UUID_RE.test(paymentId)) {
    return NextResponse.json({ error: "Invalid paymentId format" }, { status: 400 });
  }

  // Get payment + merchant
  const { data: payment } = await supabase
    .from("payments")
    .select("*, merchants(*)")
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

  // Set up Gmail client
  const oauth2Client = new google.auth.OAuth2(
    merchant.gmail_client_id,
    clientSecret,
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // H2: Search for recent bank alerts — capped at 60 min for all requests
  const MAX_LOOKBACK_MS = 60 * 60 * 1000;
  const lookbackMs = Math.min(
    force ? 60 * 60 * 1000 : 10 * 60 * 1000,
    MAX_LOOKBACK_MS,
  );
  const afterTimestamp = Math.floor((Date.now() - lookbackMs) / 1000);
  const query = `from:alerts@hdfcbank.bank.in after:${afterTimestamp}`;

  try {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 5,
    });

    const messageIds = listRes.data.messages ?? [];

    if (messageIds.length === 0) {
      return NextResponse.json({ verified: false, status: "pending", message: "No bank alerts found yet" });
    }

    const expectedAmount = Number(payment.amount_with_paisa ?? payment.amount);

    for (const msg of messageIds) {
      if (!msg.id) continue;

      const detail = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" });
      const payload = detail.data.payload;
      if (!payload) continue;

      const body = extractBody(payload);
      if (!body) continue;

      const headers = payload.headers ?? [];
      const subject = headers.find((h: { name?: string | null }) => h.name?.toLowerCase() === "subject")?.value ?? "";

      // Parse with core library (Zod-validated structured output via LangChain)
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
      const geminiApiKey = rawLlmKey || GEMINI_API_KEY;
      if (!geminiApiKey) {
        return NextResponse.json({ verified: false, status: "pending", message: "No LLM API key configured" });
      }

      const llmConfig: LlmConfig = { provider: "gemini", apiKey: geminiApiKey };
      const fromHeader = headers.find((h: { name?: string | null }) => h.name?.toLowerCase() === "from")?.value ?? "";

      let parsed: ParsedPayment | null;
      try {
        parsed = await parsePaymentEmail(
          { id: msg.id, subject, body, from: fromHeader, receivedAt: new Date() },
          llmConfig,
        );
      } catch {
        continue;
      }
      if (!parsed) continue;

      // Dedup check: has this UPI reference ID already been verified for this merchant?
      let dedupPassed = true;
      if (parsed.upiReferenceId) {
        const { data: existingPayment } = await supabase
          .from("payments")
          .select("id")
          .eq("merchant_id", merchant.id)
          .eq("upi_reference_id", parsed.upiReferenceId)
          .eq("status", "verified")
          .neq("id", paymentId)
          .limit(1)
          .maybeSingle();
        if (existingPayment) {
          dedupPassed = false;
        }
      }

      // Record evidence
      await supabase.from("verification_evidence").insert({
        payment_id: paymentId,
        source: "gmail",
        status: parsed.isPaymentEmail && Math.abs(parsed.amount - expectedAmount) <= 0.01 && dedupPassed ? "match" : "no_match",
        confidence: parsed.confidence,
        extracted_amount: parsed.amount,
        extracted_upi_ref: parsed.upiReferenceId,
        extracted_sender: parsed.senderName,
        extracted_bank: parsed.bankName,
        layer_results: {
          format_check: parsed.isPaymentEmail,
          amount_match: Math.abs(parsed.amount - expectedAmount) <= 0.01,
          time_window: true,
          dedup_check: dedupPassed,
        },
      });

      if (!dedupPassed) {
        console.warn("[verify] Duplicate UPI reference ID rejected:", parsed.upiReferenceId);
        continue;
      }

      if (!parsed.isPaymentEmail) continue;

      // Core library already validates via Zod schema — confidence, amount, UPI ref format
      // are guaranteed to be present and correctly typed. Additional sanity check:
      if (parsed.confidence < 0.5) {
        console.warn("[verify] Low confidence, skipping email:", { confidence: parsed.confidence, upiRef: parsed.upiReferenceId });
        continue;
      }

      // Amount match
      if (Math.abs(parsed.amount - expectedAmount) <= 0.01) {
        // VERIFIED! Conditional update to prevent TOCTOU race
        const { data: updated } = await supabase
          .from("payments")
          .update({
            status: "verified",
            verification_source: "gmail",
            overall_confidence: parsed.confidence,
            upi_reference_id: parsed.upiReferenceId,
            sender_name: parsed.senderName,
            bank_name: parsed.bankName,
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

        return NextResponse.json({
          verified: true,
          status: "verified",
          payment: {
            amount: parsed.amount,
            upiReferenceId: parsed.upiReferenceId,
            senderName: parsed.senderName,
            bankName: parsed.bankName,
            confidence: parsed.confidence,
          },
        });
      }
    }

    return NextResponse.json({ verified: false, status: "pending", message: `No matching ₹${expectedAmount} credit found` });
  } catch (error) {
    return NextResponse.json({
      verified: false,
      status: "pending",
      message: error instanceof Error ? error.message : "Gmail fetch error",
    });
  }
}

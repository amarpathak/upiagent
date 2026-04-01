import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchAndVerifyPayment,
  decrypt,
  isEncrypted,
} from "@upiagent/core";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// ── H1: Demo merchant safeguard ──────────────────────────
const DEMO_UPI_ID = process.env.DEMO_UPI_ID || "demo@ybl";

// ── H2: Lookback cap ────────────────────────────────────
const MAX_LOOKBACK_MINUTES = 10;

// ── Rate limiter — 3/min per IP, 30/min global ─────────
const PER_IP_RATE_LIMIT = 3;
const GLOBAL_RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();
let globalHits = { count: 0, resetAt: Date.now() + RATE_WINDOW_MS };

function isRateLimited(ip: string): boolean {
  const now = Date.now();

  // Global rate limit
  if (now > globalHits.resetAt) {
    globalHits = { count: 1, resetAt: now + RATE_WINDOW_MS };
  } else {
    globalHits.count++;
    if (globalHits.count > GLOBAL_RATE_LIMIT) return true;
  }

  // Per-IP rate limit
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > PER_IP_RATE_LIMIT;
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits) {
    if (now > entry.resetAt) hits.delete(ip);
  }
}, 300_000);

/**
 * POST /api/verify
 * Body: { expectedAmount: number, lookbackMinutes?: number }
 *
 * Demo verification — uses the demo merchant's Gmail credentials.
 * Rate-limited. Credentials decrypted at runtime.
 * Uses core's fetchAndVerifyPayment() with preset: "demo" for
 * in-memory dedup, relaxed confidence, and PII redaction.
 */
export async function POST(req: Request) {
  // Rate limit by IP + global
  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Rate limited. Try again in a minute." }, { status: 429 });
  }

  const { expectedAmount, lookbackMinutes: rawLookback = 5 } = await req.json();

  // H2: Cap lookback to MAX_LOOKBACK_MINUTES
  const lookbackMinutes = Math.min(Math.max(rawLookback, 1), MAX_LOOKBACK_MINUTES);

  if (!expectedAmount || expectedAmount > 3) {
    return NextResponse.json({ error: "Demo: amount must be ₹1–3" }, { status: 400 });
  }

  // Get demo merchant — filter by demo UPI ID (H1)
  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, upi_id, name, gmail_client_id, gmail_client_secret, gmail_refresh_token, llm_api_key")
    .eq("upi_id", DEMO_UPI_ID)
    .not("gmail_refresh_token", "is", null)
    .limit(1)
    .single();

  if (!merchant?.gmail_refresh_token) {
    return NextResponse.json({ verified: false, message: "Demo merchant not configured" });
  }

  // H1: Double-check the merchant UPI ID matches the demo ID
  if (merchant.upi_id !== DEMO_UPI_ID) {
    console.error("[verify] Merchant UPI ID mismatch: expected", DEMO_UPI_ID, "got", merchant.upi_id);
    return NextResponse.json({ error: "Demo endpoint misconfigured" }, { status: 500 });
  }

  // Decrypt credentials with strict encryption checks
  const encKey = process.env.CREDENTIALS_ENCRYPTION_KEY;

  const secretEncrypted = merchant.gmail_client_secret && isEncrypted(merchant.gmail_client_secret);
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

  // Resolve LLM API key (merchant's own or platform default)
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
    return NextResponse.json({ verified: false, message: "No LLM API key configured" });
  }

  try {
    const result = await fetchAndVerifyPayment({
      gmail: {
        clientId: merchant.gmail_client_id || process.env.GMAIL_CLIENT_ID!,
        clientSecret: clientSecret,
        refreshToken: refreshToken,
      },
      llm: {
        provider: "gemini",
        model: "gemini-2.0-flash",
        apiKey: geminiApiKey,
      },
      expected: {
        amount: expectedAmount,
        timeWindowMinutes: 30,
      },
      preset: "demo",
      lookbackMinutes,
      maxEmails: 5,
    });

    return NextResponse.json({
      verified: result.verified,
      payment: result.payment,
      confidence: result.confidence,
      failureReason: result.failureReason,
      // Map failureDetails to message for backward compat with frontend
      message: result.verified
        ? undefined
        : result.failureDetails || `No matching ₹${expectedAmount} credit found`,
    });
  } catch (error) {
    console.error("[verify] Error:", error);
    return NextResponse.json({
      verified: false,
      message: error instanceof Error ? error.message : "Verification error",
    });
  }
}

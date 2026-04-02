// apps/www/src/lib/demo-verify.ts
import { createClient } from "@supabase/supabase-js";
import {
  fetchAndVerifyPayment,
  decrypt,
  isEncrypted,
  WebhookSender,
  CostTracker,
  LlmRateLimiter,
  type WebhookPayload,
} from "@upiagent/core";
import { randomUUID } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const DEMO_UPI_ID = process.env.DEMO_UPI_ID || "demo@ybl";
const DEMO_WEBHOOK_SECRET = process.env.DEMO_WEBHOOK_SECRET || "0".repeat(64);

const webhookSender = new WebhookSender({ retryDelaysMs: [500, 2000, 5000] });

// ── Cost tracking — shared across all demo verifications ──
// Budget: 50K tokens per instance lifetime (prevents runaway costs)
const costTracker = new CostTracker({ budgetTokens: 50_000 });

// ── LLM rate limiter — prevents hammering the API ─────────
// 10 calls/min, 60 calls/hour for the entire demo
const llmRateLimiter = new LlmRateLimiter({
  maxCallsPerMinute: 10,
  maxCallsPerHour: 60,
});

/**
 * Check if an error is a provider rate limit (429).
 * When the provider itself is rate-limited, retrying is pointless —
 * we'd just burn through our own rate limiter quota for nothing.
 */
function isProviderRateLimitError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("quota");
}

export async function runDemoVerification(
  paymentId: string,
  expectedAmount: number,
): Promise<void> {
  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, upi_id, gmail_client_id, gmail_client_secret, gmail_refresh_token, llm_api_key, webhook_url, webhook_secret")
    .eq("upi_id", DEMO_UPI_ID)
    .not("gmail_refresh_token", "is", null)
    .limit(1)
    .single();

  if (!merchant?.gmail_refresh_token) {
    console.error("[bg-verify] Demo merchant not configured");
    return;
  }

  const encKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  const clientSecret = encKey && isEncrypted(merchant.gmail_client_secret)
    ? decrypt(merchant.gmail_client_secret, encKey)
    : merchant.gmail_client_secret;
  const refreshToken = encKey && isEncrypted(merchant.gmail_refresh_token)
    ? decrypt(merchant.gmail_refresh_token, encKey)
    : merchant.gmail_refresh_token;

  const llmKeyEncrypted = merchant.llm_api_key && isEncrypted(merchant.llm_api_key);
  const rawLlmKey = encKey && llmKeyEncrypted
    ? decrypt(merchant.llm_api_key, encKey)
    : merchant.llm_api_key;
  const geminiApiKey = rawLlmKey || GEMINI_API_KEY;

  if (!geminiApiKey) {
    console.error("[bg-verify] No LLM API key configured");
    return;
  }

  const webhookUrl = merchant.webhook_url || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/webhook/demo`;
  const webhookSecret = merchant.webhook_secret || DEMO_WEBHOOK_SECRET;

  // Log cost state at start
  const usageBefore = costTracker.getUsage();
  console.log(`[bg-verify] Starting verification for ${paymentId} (₹${expectedAmount}). LLM usage so far: ${usageBefore.totalTokens} tokens, ${usageBefore.callCount} calls`);

  await sleep(5000);

  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const result = await fetchAndVerifyPayment({
        gmail: {
          clientId: merchant.gmail_client_id || process.env.GMAIL_CLIENT_ID!,
          clientSecret,
          refreshToken,
        },
        llm: {
          provider: "gemini",
          model: "gemini-2.0-flash-lite",
          apiKey: geminiApiKey,
        },
        expected: {
          amount: expectedAmount,
          timeWindowMinutes: 30,
        },
        preset: "demo",
        lookbackMinutes: 10,
        maxEmails: 5,
        costTracker,
        rateLimiter: llmRateLimiter,
      });

      if (result.verified && result.payment) {
        const usage = costTracker.getUsage();
        console.log(`[bg-verify] Payment ${paymentId} verified on attempt ${attempt}. Total LLM usage: ${usage.totalTokens} tokens, ${usage.callCount} calls`);

        const payload: WebhookPayload = {
          event: "payment.verified",
          timestamp: new Date().toISOString(),
          deliveryId: `d_${randomUUID()}`,
          data: {
            paymentId,
            amount: result.payment.amount,
            currency: "INR",
            status: "verified",
            upiReferenceId: result.payment.upiReferenceId,
            senderName: result.payment.senderName,
            confidence: result.confidence,
            verifiedAt: new Date().toISOString(),
          },
        };

        await webhookSender.send(webhookUrl, webhookSecret, payload);
        return;
      }
    } catch (err) {
      console.error(`[bg-verify] Attempt ${attempt} error:`, err instanceof Error ? err.message : err);

      // Stop immediately on provider rate limit — retrying won't help
      if (isProviderRateLimitError(err)) {
        console.error(`[bg-verify] Provider rate limit hit — stopping retries for ${paymentId}`);

        const expiredPayload: WebhookPayload = {
          event: "payment.expired",
          timestamp: new Date().toISOString(),
          deliveryId: `d_${randomUUID()}`,
          data: {
            paymentId,
            amount: expectedAmount,
            currency: "INR",
            status: "expired",
          },
        };

        await webhookSender.send(webhookUrl, webhookSecret, expiredPayload);

        const usage = costTracker.getUsage();
        console.log(`[bg-verify] LLM usage at abort: ${usage.totalTokens} tokens, ${usage.callCount} calls`);
        return;
      }
    }

    if (attempt < 6) {
      await sleep(10000);
    }
  }

  // All attempts exhausted
  const usage = costTracker.getUsage();
  console.log(`[bg-verify] Payment ${paymentId} expired after 6 attempts. Total LLM usage: ${usage.totalTokens} tokens, ${usage.callCount} calls`);

  const expiredPayload: WebhookPayload = {
    event: "payment.expired",
    timestamp: new Date().toISOString(),
    deliveryId: `d_${randomUUID()}`,
    data: {
      paymentId,
      amount: expectedAmount,
      currency: "INR",
      status: "expired",
    },
  };

  await webhookSender.send(webhookUrl, webhookSecret, expiredPayload);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

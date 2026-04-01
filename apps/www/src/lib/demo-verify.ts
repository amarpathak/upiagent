// apps/www/src/lib/demo-verify.ts
import { createClient } from "@supabase/supabase-js";
import {
  fetchAndVerifyPayment,
  decrypt,
  isEncrypted,
  WebhookSender,
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
          model: "gemini-2.0-flash",
          apiKey: geminiApiKey,
        },
        expected: {
          amount: expectedAmount,
          timeWindowMinutes: 30,
        },
        preset: "demo",
        lookbackMinutes: 10,
        maxEmails: 5,
      });

      if (result.verified && result.payment) {
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
        console.log(`[bg-verify] Payment ${paymentId} verified on attempt ${attempt}`);
        return;
      }
    } catch (err) {
      console.error(`[bg-verify] Attempt ${attempt} error:`, err);
    }

    if (attempt < 6) {
      await sleep(10000);
    }
  }

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
  console.log(`[bg-verify] Payment ${paymentId} expired after 6 attempts`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

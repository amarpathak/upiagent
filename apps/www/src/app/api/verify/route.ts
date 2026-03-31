import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { decrypt, isEncrypted } from "@upiagent/core";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// ── Rate limiter (mitigation #4) ──────────────────────────
// 10 requests per IP per minute
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits) {
    if (now > entry.resetAt) hits.delete(ip);
  }
}, 300_000);

// ── Helpers ───────────────────────────────────────────────
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

type Payload = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: Array<{ mimeType?: string | null; body?: { data?: string | null } | null }> | null;
};

function extractBody(payload: Payload): string {
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
 * Body: { expectedAmount: number, lookbackMinutes?: number }
 *
 * Demo verification — uses the first merchant's Gmail credentials.
 * Rate-limited. Credentials decrypted at runtime.
 */
export async function POST(req: Request) {
  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Rate limited. Try again in a minute." }, { status: 429 });
  }

  const { expectedAmount, lookbackMinutes = 5 } = await req.json();

  if (!expectedAmount || expectedAmount > 3) {
    return NextResponse.json({ error: "Demo: amount must be ₹1–3" }, { status: 400 });
  }

  // Get demo merchant
  const { data: merchant } = await supabase
    .from("merchants")
    .select("*")
    .not("gmail_refresh_token", "is", null)
    .limit(1)
    .single();

  if (!merchant?.gmail_refresh_token) {
    return NextResponse.json({ verified: false, message: "Demo merchant not configured" });
  }

  // Decrypt credentials (mitigation #2)
  const encKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  const clientSecret = encKey && merchant.gmail_client_secret && isEncrypted(merchant.gmail_client_secret)
    ? decrypt(merchant.gmail_client_secret, encKey)
    : merchant.gmail_client_secret;
  const refreshToken = encKey && isEncrypted(merchant.gmail_refresh_token)
    ? decrypt(merchant.gmail_refresh_token, encKey)
    : merchant.gmail_refresh_token;

  // Set up Gmail client
  const oauth2Client = new google.auth.OAuth2(
    merchant.gmail_client_id,
    clientSecret,
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const afterTimestamp = Math.floor((Date.now() - lookbackMinutes * 60 * 1000) / 1000);
  const query = `from:alerts@hdfcbank.bank.in after:${afterTimestamp}`;

  try {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 5,
    });

    const messageIds = listRes.data.messages ?? [];
    if (messageIds.length === 0) {
      return NextResponse.json({ verified: false, message: "No bank alerts found yet" });
    }

    for (const msg of messageIds) {
      if (!msg.id) continue;

      const detail = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" });
      const payload = detail.data.payload;
      if (!payload) continue;

      const body = extractBody(payload as Payload);
      if (!body) continue;

      const headers = payload.headers ?? [];
      const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";

      const rawLlmKey = merchant.llm_api_key && encKey && isEncrypted(merchant.llm_api_key)
        ? decrypt(merchant.llm_api_key, encKey)
        : merchant.llm_api_key;
      const geminiApiKey = rawLlmKey || GEMINI_API_KEY;
      if (!geminiApiKey) {
        return NextResponse.json({ verified: false, message: "No LLM API key configured" });
      }

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Extract payment info from this bank email. Return ONLY valid JSON, no markdown.

Subject: ${subject}
Body: ${body}

Return: {"amount": number, "upiReferenceId": "string", "senderName": "string", "bankName": "string", "isCredit": true/false, "confidence": 0.0-1.0}

If NOT a credit/received payment, set isCredit to false.`,
              }],
            }],
            generationConfig: { temperature: 0 },
          }),
        },
      );

      if (!geminiRes.ok) continue;

      const geminiData = await geminiRes.json();
      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      let parsed;
      try { parsed = JSON.parse(jsonMatch[0]); } catch { continue; }

      if (!parsed.isCredit) continue;

      if (Math.abs(parsed.amount - expectedAmount) <= 0.01) {
        return NextResponse.json({
          verified: true,
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

    return NextResponse.json({ verified: false, message: `No matching ₹${expectedAmount} credit found` });
  } catch (error) {
    console.error("[verify] Error:", error);
    return NextResponse.json({
      verified: false,
      message: error instanceof Error ? error.message : "Verification error",
    });
  }
}

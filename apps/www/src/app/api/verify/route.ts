import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

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
 * Demo verification — uses the first merchant's Gmail credentials from Supabase.
 * For the landing page live demo only.
 */
export async function POST(req: Request) {
  const { expectedAmount, lookbackMinutes = 5 } = await req.json();

  if (!expectedAmount) {
    return NextResponse.json({ error: "expectedAmount required" }, { status: 400 });
  }

  // Get the demo merchant (first merchant with gmail connected)
  const { data: merchant } = await supabase
    .from("merchants")
    .select("*")
    .not("gmail_refresh_token", "is", null)
    .limit(1)
    .single();

  if (!merchant?.gmail_refresh_token || !merchant?.gmail_client_id || !merchant?.gmail_client_secret) {
    return NextResponse.json({
      verified: false,
      message: "Demo merchant Gmail not connected",
    });
  }

  // Set up Gmail client
  const oauth2Client = new google.auth.OAuth2(
    merchant.gmail_client_id,
    merchant.gmail_client_secret,
  );
  oauth2Client.setCredentials({ refresh_token: merchant.gmail_refresh_token });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Search for recent bank alerts
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

      // Parse with Gemini
      const geminiApiKey = merchant.llm_api_key || GEMINI_API_KEY;
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

      // Amount match
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

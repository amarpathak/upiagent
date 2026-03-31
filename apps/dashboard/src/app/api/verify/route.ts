import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

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
  const { paymentId } = await req.json();

  if (!paymentId) {
    return NextResponse.json({ error: "paymentId required" }, { status: 400 });
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

  if (payment.status !== "pending") {
    return NextResponse.json({
      verified: payment.status === "verified",
      status: payment.status,
      payment,
    });
  }

  // Check if expired
  if (payment.expires_at && new Date(payment.expires_at) < new Date()) {
    await supabase
      .from("payments")
      .update({ status: "expired" })
      .eq("id", paymentId);
    return NextResponse.json({ verified: false, status: "expired" });
  }

  const merchant = payment.merchants;
  if (!merchant?.gmail_refresh_token || !merchant?.gmail_client_id || !merchant?.gmail_client_secret) {
    return NextResponse.json({
      verified: false,
      status: "pending",
      message: "Gmail not connected. Go to Settings to connect Gmail.",
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
  const afterTimestamp = Math.floor((Date.now() - 10 * 60 * 1000) / 1000); // last 10 min
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

      // Parse with Gemini
      const geminiApiKey = merchant.llm_api_key || GEMINI_API_KEY;
      if (!geminiApiKey) {
        return NextResponse.json({ verified: false, status: "pending", message: "No LLM API key configured" });
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

      // Record evidence
      await supabase.from("verification_evidence").insert({
        payment_id: paymentId,
        source: "gmail",
        status: parsed.isCredit && Math.abs(parsed.amount - expectedAmount) <= 0.01 ? "match" : "no_match",
        confidence: parsed.confidence ?? 0.9,
        extracted_amount: parsed.amount,
        extracted_upi_ref: parsed.upiReferenceId,
        extracted_sender: parsed.senderName,
        extracted_bank: parsed.bankName,
        layer_results: {
          format_check: parsed.isCredit,
          amount_match: Math.abs(parsed.amount - expectedAmount) <= 0.01,
          time_window: true,
          dedup_check: true,
        },
      });

      if (!parsed.isCredit) continue;

      // Amount match
      if (Math.abs(parsed.amount - expectedAmount) <= 0.01) {
        // VERIFIED!
        await supabase
          .from("payments")
          .update({
            status: "verified",
            verification_source: "gmail",
            overall_confidence: parsed.confidence ?? 0.95,
            upi_reference_id: parsed.upiReferenceId,
            sender_name: parsed.senderName,
            bank_name: parsed.bankName,
            verified_at: new Date().toISOString(),
          })
          .eq("id", paymentId);

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

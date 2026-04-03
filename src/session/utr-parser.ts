/**
 * UTR Extraction — parse UPI transaction reference numbers from text and images.
 *
 * UTR formats in Indian banking:
 * - IMPS: 12 digits (e.g., "412345678901")
 * - NEFT/RTGS: 4-letter bank code + 12 digits (e.g., "HDFC0012345678901" — 16 chars)
 * - UPI Ref: varies by app — typically 12-digit or alphanumeric 9-35 chars
 *
 * Priority order (stop early when higher-priority match found):
 * 1. Labeled extraction — "UTR: 412345678901" (highest confidence)
 * 2a. 12-digit IMPS pattern
 * 2b. 16-char NEFT/RTGS pattern (4 alpha + 12 digits)
 * 3. Alphanumeric fallback — ONLY if 1, 2a, 2b all empty
 *
 * PhonePe gotcha: shows both "UPI Transaction ID" (internal, not real UTR) and
 * "UPI Ref No" (real UTR). If Pattern 1 finds a labeled match, skip Pattern 3
 * entirely to avoid picking up the internal ID.
 */

import { z } from "zod/v4";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage } from "@langchain/core/messages";
import type { UtrCandidate } from "./types.js";
import type { LlmConfig } from "../llm/types.js";

// ── Normalization ───────────────────────────────────────────────────

/**
 * Normalize a UTR for comparison.
 * Applied on both sides — when storing via registerUTR AND when extracting from bank alert.
 */
export function normalizeUtr(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, "")       // collapse whitespace
    .toUpperCase()
    .replace(/^(UTR|REF|#)+/i, "")  // strip common prefixes
    .trim();
}

// ── Text Extraction ─────────────────────────────────────────────────

// Pattern 1: Labeled extraction — highest confidence
const LABELED_PATTERN =
  /(?:UTR|UPI\s*Ref(?:\s*No)?|Ref(?:erence)?\s*(?:No|ID|Number)?|Transaction\s*(?:ID|Reference|No)|Bank\s*Ref(?:\s*No)?)\s*[:\-\u2013\u2014.]?\s*([A-Za-z0-9]{9,35})/gi;

// Pattern 2a: 12-digit IMPS UTR
const IMPS_PATTERN = /\b(\d{12})\b/g;

// Pattern 2b: 16-char NEFT/RTGS UTR — 4-letter bank code + 12 digits
const NEFT_PATTERN = /\b([A-Z]{4}\d{12})\b/gi;

// Pattern 3: Alphanumeric fallback — only used when 1, 2a, 2b all empty
const FALLBACK_PATTERN = /\b([A-Za-z]\w{15,34})\b/g;

/**
 * Extract UTR candidates from text input.
 * Returns deduplicated candidates sorted by confidence (highest first).
 */
export function extractUtrFromText(text: string): UtrCandidate[] {
  const seen = new Set<string>();
  const candidates: UtrCandidate[] = [];

  function addCandidate(utr: string, source: UtrCandidate["source"], confidence: number) {
    const normalized = normalizeUtr(utr);
    if (normalized.length < 9 || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push({ utr: normalized, source, confidence });
  }

  // Pattern 1: Labeled extraction
  let match: RegExpExecArray | null;
  LABELED_PATTERN.lastIndex = 0;
  while ((match = LABELED_PATTERN.exec(text)) !== null) {
    if (match[1]) addCandidate(match[1], "labeled", 0.95);
  }

  // Pattern 2a: IMPS (12-digit)
  IMPS_PATTERN.lastIndex = 0;
  while ((match = IMPS_PATTERN.exec(text)) !== null) {
    if (match[1]) addCandidate(match[1], "imps", 0.8);
  }

  // Pattern 2b: NEFT/RTGS
  NEFT_PATTERN.lastIndex = 0;
  while ((match = NEFT_PATTERN.exec(text)) !== null) {
    if (match[1]) addCandidate(match[1], "neft", 0.8);
  }

  // Pattern 3: Fallback — ONLY if no higher-priority matches found
  // PhonePe gotcha: if Pattern 1 found a labeled match, skip this entirely
  if (candidates.length === 0) {
    FALLBACK_PATTERN.lastIndex = 0;
    while ((match = FALLBACK_PATTERN.exec(text)) !== null) {
      if (match[1]) addCandidate(match[1], "fallback", 0.4);
    }
  }

  // Sort by confidence descending
  return candidates.sort((a, b) => b.confidence - a.confidence);
}

// ── Image OCR Extraction ────────────────────────────────────────────

/**
 * Zod schema for OCR extraction response from Gemini Vision.
 */
const ocrResponseSchema = z.object({
  candidates: z.array(
    z.object({
      utr: z.string().describe("The UTR/reference number extracted from the screenshot"),
      label: z.string().describe("The label near this number in the screenshot (e.g., 'UPI Ref No', 'Transaction ID')"),
      confidence: z.number().min(0).max(1).describe("Confidence in this extraction (0-1)"),
    }),
  ),
});

const OCR_PROMPT = `You are a UPI payment screenshot parser. Extract UTR (Unique Transaction Reference) numbers from this payment screenshot.

Look for:
- "UPI Ref No", "UTR", "Reference ID", "Transaction ID", "Bank Reference"
- 12-digit numeric codes (IMPS UTR)
- 16-character alphanumeric codes starting with 4 letters (NEFT/RTGS UTR)

Return the top 2-3 candidates with their labels and confidence scores.
If you cannot find any UTR-like numbers, return an empty candidates array.

IMPORTANT: Different apps show different IDs:
- PhonePe shows "UPI Transaction ID" (internal, NOT the real UTR) and "UPI Ref No" (real UTR)
- GPay shows "UPI transaction ID" which IS the real UTR
- Paytm shows "Transaction ID" which may or may not be the UTR

Respond in this exact JSON format:
{
  "candidates": [
    { "utr": "412345678901", "label": "UPI Ref No", "confidence": 0.95 }
  ]
}`;

/**
 * Extract UTR candidates from a payment screenshot using Gemini Vision OCR.
 *
 * Reuses the existing LangChain model factory pattern from llm/chain.ts.
 * Low-confidence results (<0.5) are still returned — the caller decides
 * whether to fall back to amount matching.
 */
export async function extractUtrFromImage(
  imageBuffer: Buffer,
  llmConfig: LlmConfig,
): Promise<UtrCandidate[]> {
  // Dynamic import to reuse the existing model factory
  const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
  const { ChatOpenAI } = await import("@langchain/openai");

  let model: BaseChatModel;

  // For OCR, we prefer Gemini (best vision), but support OpenAI too
  switch (llmConfig.provider) {
    case "gemini":
      model = new ChatGoogleGenerativeAI({
        apiKey: llmConfig.apiKey,
        model: llmConfig.model,
        temperature: 0,
        maxRetries: 0,
      });
      break;
    case "openai":
    case "openrouter":
      model = new ChatOpenAI({
        apiKey: llmConfig.apiKey,
        model: llmConfig.model,
        temperature: 0,
        maxRetries: 0,
        ...(llmConfig.provider === "openrouter"
          ? { configuration: { baseURL: "https://openrouter.ai/api/v1" } }
          : {}),
      });
      break;
    default:
      throw new Error(`OCR not supported for provider: ${llmConfig.provider}. Use gemini or openai.`);
  }

  const base64Image = imageBuffer.toString("base64");
  const mimeType = "image/png"; // Safe default — most screenshot formats work

  const message = new HumanMessage({
    content: [
      { type: "text", text: OCR_PROMPT },
      {
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64Image}` },
      },
    ],
  });

  const response = await model.invoke([message]);
  const responseText = typeof response.content === "string"
    ? response.content
    : response.content
        .filter((c): c is { type: "text"; text: string } => typeof c === "object" && "type" in c && c.type === "text")
        .map((c) => c.text)
        .join("");

  // Parse JSON from response (handle markdown code blocks)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return [];
  }

  let parsed: z.infer<typeof ocrResponseSchema>;
  try {
    parsed = ocrResponseSchema.parse(JSON.parse(jsonMatch[0]));
  } catch {
    return [];
  }

  // Convert OCR candidates to UtrCandidates with normalization
  return parsed.candidates
    .map((c) => ({
      utr: normalizeUtr(c.utr),
      source: "labeled" as const, // OCR with labels is equivalent to labeled text extraction
      confidence: c.confidence,
    }))
    .filter((c) => c.utr.length >= 9);
}

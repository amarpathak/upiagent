/**
 * Email Parsing Utilities
 *
 * Extracted from GmailClient so they can be tested independently.
 * This is a common refactoring pattern: when a class has private methods
 * that are complex enough to need their own tests, extract them into
 * pure functions. The class still uses them, but now tests can too.
 *
 * "Pure function" = same input always gives same output, no side effects.
 * These are the easiest kind of code to test and the hardest to have bugs in.
 */

import type { gmail_v1 } from "googleapis";
import type { EmailMessage } from "./types.js";

/**
 * Decodes Gmail's base64url-encoded body data.
 *
 * Gmail uses "base64url" encoding (RFC 4648) — like regular base64
 * but with - instead of + and _ instead of /. This makes it URL-safe,
 * which matters because email content sometimes passes through URLs.
 */
export function decodeBase64Url(data: string): string {
  if (!data) return "";
  const standardBase64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(standardBase64, "base64").toString("utf-8");
}

/**
 * Strips HTML tags to get plain text.
 *
 * Bank alert emails often come as HTML-only (especially HDFC and ICICI).
 * We need clean text for the LLM parser — HTML noise confuses extraction.
 *
 * This is a basic strip, not a full HTML parser. For bank alert emails,
 * it's sufficient because the content is simple text in styled wrappers.
 */
export function stripHtmlTags(html: string): string {
  if (!html) return "";
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

/**
 * Recursively extracts plain text from a MIME message payload.
 *
 * MIME (Multipurpose Internet Mail Extensions) is the format email uses
 * to support multiple content types. A single email can contain:
 * - text/plain (what we want)
 * - text/html (fallback)
 * - image/png (inline images)
 * - application/pdf (attachments)
 *
 * These are nested in multipart containers. We traverse the tree to find text.
 */
export function extractTextBody(payload: gmail_v1.Schema$MessagePart): string {
  // Case 1: This part IS the text body (simple message or leaf node)
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Case 2: This is a multipart container — recurse into its parts
  if (payload.parts) {
    // First pass: look for text/plain
    for (const part of payload.parts) {
      const text = extractTextBody(part);
      if (text) return text;
    }

    // Second pass: fall back to HTML and strip tags
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return stripHtmlTags(decodeBase64Url(part.body.data));
      }
    }
  }

  // Case 3: Single-part HTML message (no multipart wrapper)
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return stripHtmlTags(decodeBase64Url(payload.body.data));
  }

  return "";
}

/**
 * Parses a raw Gmail API message into our clean EmailMessage format.
 */
export function parseGmailMessage(message: gmail_v1.Schema$Message): EmailMessage | null {
  if (!message.id || !message.payload) {
    return null;
  }

  const headers = message.payload.headers ?? [];

  const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
  const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
  const dateStr = headers.find((h) => h.name?.toLowerCase() === "date")?.value;

  // internalDate is Gmail's own timestamp (milliseconds since epoch).
  // More reliable than the Date header which can be spoofed by the sender.
  // For financial verification, we always prefer server-side timestamps.
  const receivedAt = message.internalDate
    ? new Date(parseInt(message.internalDate, 10))
    : dateStr
      ? new Date(dateStr)
      : new Date();

  const body = extractTextBody(message.payload);

  return {
    id: message.id,
    subject,
    body,
    from,
    receivedAt,
  };
}

// packages/core/src/webhook/sender.ts
import { signWebhookPayload } from "./verify.js";
import type { WebhookPayload, WebhookDeliveryResult } from "./types.js";

interface WebhookSenderOptions {
  maxRetries?: number;
  retryDelaysMs?: number[];
}

const DEFAULT_RETRY_DELAYS = [1000, 5000, 25000];

/** Reject private/internal IPs, non-HTTPS, and credential-bearing URLs to prevent SSRF */
function validateWebhookUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid webhook URL: ${url}`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`Webhook URL must use HTTPS: ${url}`);
  }

  // Block URLs with embedded credentials (https://user:pass@host)
  if (parsed.username || parsed.password) {
    throw new Error(`Webhook URL must not contain credentials: ${url}`);
  }

  // Normalize hostname — strip brackets from IPv6
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // Block localhost (IPv4 and IPv6)
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    throw new Error(`Webhook URL must not target localhost: ${url}`);
  }

  // Block private IP ranges (RFC 1918 + link-local + metadata + IPv6 private)
  const privatePatterns = [
    // IPv4 private
    /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
    // IPv4 link-local + metadata
    /^169\.254\./, /^0\./, /^127\./,
    // IPv6 private (fc00::/7 = fc00:: and fd00::)
    /^fc/i, /^fd/i,
    // IPv6 link-local
    /^fe80:/i,
  ];
  for (const pattern of privatePatterns) {
    if (pattern.test(hostname)) {
      throw new Error(`Webhook URL must not target private/internal addresses: ${url}`);
    }
  }
}

export class WebhookSender {
  private readonly maxRetries: number;
  private readonly retryDelays: number[];

  constructor(options: WebhookSenderOptions = {}) {
    this.retryDelays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS;
    this.maxRetries = options.maxRetries ?? this.retryDelays.length;
  }

  async send(
    url: string,
    secretHex: string,
    payload: WebhookPayload,
  ): Promise<WebhookDeliveryResult> {
    validateWebhookUrl(url);

    const body = JSON.stringify(payload);
    const signature = signWebhookPayload(body, secretHex);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-UpiAgent-Signature": signature,
            "X-UpiAgent-Event": payload.event,
            "X-UpiAgent-Delivery-Id": payload.deliveryId,
          },
          body,
        });

        if (response.ok) {
          return {
            delivered: true,
            attempts: attempt,
            responseStatus: response.status,
          };
        }

        if (attempt === this.maxRetries) {
          return {
            delivered: false,
            attempts: attempt,
            responseStatus: response.status,
            error: `HTTP ${response.status}`,
          };
        }
      } catch (err) {
        if (attempt === this.maxRetries) {
          return {
            delivered: false,
            attempts: attempt,
            error: err instanceof Error ? err.message : "Network error",
          };
        }
      }

      const delay =
        this.retryDelays[attempt - 1] ??
        this.retryDelays[this.retryDelays.length - 1]!;
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return { delivered: false, attempts: this.maxRetries, error: "Max retries exceeded" };
  }
}

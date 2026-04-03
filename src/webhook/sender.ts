// packages/core/src/webhook/sender.ts
import { signWebhookPayload } from "./verify.js";
import type { WebhookPayload, WebhookDeliveryResult } from "./types.js";

interface WebhookSenderOptions {
  maxRetries?: number;
  retryDelaysMs?: number[];
}

const DEFAULT_RETRY_DELAYS = [1000, 5000, 25000];

/** Reject private/internal IPs and non-HTTPS to prevent SSRF */
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

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]") {
    throw new Error(`Webhook URL must not target localhost: ${url}`);
  }

  // Block private IP ranges (RFC 1918 + link-local + metadata)
  const privatePatterns = [
    /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
    /^169\.254\./, /^0\./, /^127\./, /^fc00:/i, /^fd/i, /^fe80:/i,
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

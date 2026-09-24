/**
 * UpiAgent Client SDK
 *
 * Thin wrapper around the UpiAgent SaaS API.
 * Like Stripe's SDK — handles auth, requests, and types.
 *
 * Usage:
 *   import { UpiAgent } from "upiagent/client";
 *
 *   const upi = new UpiAgent({ apiKey: "upi_ak_..." });
 *   const payment = await upi.createPayment({ amount: 499, addPaisa: true });
 *   const result = await upi.verify(payment.id);
 *   const status = await upi.getStatus(payment.id);
 */

import type { z } from "zod/v4";
import {
  createPaymentResponseSchema,
  paymentSchema,
  verifyPaymentResponseSchema,
  submitProofResponseSchema,
  listPaymentsResponseSchema,
  paymentEvidenceListSchema,
  usageSchema,
  type ListPaymentsQuery,
  type ListPaymentsResponse,
  type PaymentEvidence,
  type Usage,
  type SubmitProofRequest,
  type SubmitProofResponse,
  type CreatePaymentRequest,
  type CreatePaymentResponse,
  type Payment,
  type VerifyPaymentResponse,
} from "./contracts/index.js";

export interface UpiAgentConfig {
  apiKey: string;
  baseUrl?: string;
}

// Types come from the shared API contracts; these names are kept for
// backwards compatibility.
export type CreatePaymentParams = CreatePaymentRequest;
export type { Payment };
export type VerifyResult = VerifyPaymentResponse;

export class UpiAgentApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "UpiAgentApiError";
  }
}

export class UpiAgent {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: UpiAgentConfig) {
    if (!config.apiKey) throw new Error("apiKey is required");
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || "https://beta.upiagent.live").replace(/\/$/, "");
  }

  private async request<S extends z.ZodType>(
    schema: S,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<z.output<S>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new UpiAgentApiError(
        (data && typeof data.error === "string" && data.error) || `API error: ${res.status}`,
        res.status,
        data,
      );
    }

    // Validate against the shared contract instead of trusting an `as T` cast.
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new UpiAgentApiError(
        `Unexpected response shape from ${method} ${path}: ${parsed.error.issues[0]?.message ?? "invalid"}`,
        res.status,
        data,
      );
    }
    return parsed.data;
  }

  /**
   * Create a payment with QR code
   */
  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResponse> {
    return this.request(createPaymentResponseSchema, "POST", "/api/v1/payments", params);
  }

  /**
   * Trigger active verification (scans Gmail for bank alert)
   * Call this after the customer has paid.
   */
  async verify(paymentId: string): Promise<VerifyResult> {
    return this.request(verifyPaymentResponseSchema, "POST", `/api/v1/payments/${encodeURIComponent(paymentId)}`);
  }

  /**
   * Check payment status (read-only, no verification triggered)
   */
  async getStatus(paymentId: string): Promise<Payment> {
    return this.request(paymentSchema, "GET", `/api/v1/payments/${encodeURIComponent(paymentId)}`);
  }

  /**
   * Submit a payment screenshot. On success the payment becomes `claimed`
   * (screenshot-backed); bank evidence later upgrades it to `verified`.
   * `accepted: false` means do not deliver the goods.
   */
  async submitProof(paymentId: string, proof: SubmitProofRequest): Promise<SubmitProofResponse> {
    return this.request(
      submitProofResponseSchema,
      "POST",
      `/api/v1/payments/${encodeURIComponent(paymentId)}/proof`,
      proof,
    );
  }

  /**
   * Cancel a pending payment.
   */
  async cancel(paymentId: string): Promise<Payment> {
    return this.request(paymentSchema, "DELETE", `/api/v1/payments/${encodeURIComponent(paymentId)}`);
  }

  /**
   * List payments, newest first. Pass `nextCursor` back as `cursor` for the next page.
   */
  async listPayments(query: ListPaymentsQuery = {}): Promise<ListPaymentsResponse> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString();
    return this.request(listPaymentsResponseSchema, "GET", `/api/v1/payments${qs ? `?${qs}` : ""}`);
  }

  /**
   * Evidence trail for a payment (which sources matched, with what confidence).
   */
  async getEvidence(paymentId: string): Promise<PaymentEvidence[]> {
    const { evidence } = await this.request(
      paymentEvidenceListSchema,
      "GET",
      `/api/v1/payments/${encodeURIComponent(paymentId)}/evidence`,
    );
    return evidence;
  }

  /**
   * Today's LLM token usage against the daily limit.
   */
  async getUsage(): Promise<Usage> {
    return this.request(usageSchema, "GET", "/api/v1/usage");
  }

  /**
   * Creates a payment and waits for it to settle — for scripts and quick
   * prototypes. **Prefer webhooks** (`payment.claimed` / `payment.verified`)
   * in anything long-running.
   *
   * The wait only reads the payment's status (a free database read); it never
   * triggers Gmail or LLM verification — evidence arrives by push on the
   * server. Reads back off from `pollInterval` to 30 s, are hard-capped at
   * `maxChecks`, and stop immediately on `signal` abort.
   *
   * Returns on `verified`, on `claimed` when `acceptClaimed` is set, on
   * `expired` / `cancelled`, or with the last status at the timeout.
   */
  async createAndWaitForPayment(
    params: CreatePaymentParams,
    options?: {
      /** Called with payment after creation (show QR here) */
      onPaymentCreated?: (payment: Payment) => void;
      /** Called after each status read */
      onStatusUpdate?: (status: Payment) => void;
      /** First wait between status reads in ms (default 5000; backs off to 30 s) */
      pollInterval?: number;
      /** Timeout in ms (default 180000 = 3 min) */
      timeout?: number;
      /** Hard cap on status reads (default 20) */
      maxChecks?: number;
      /** Return as soon as the payment is `claimed` (screenshot accepted). */
      acceptClaimed?: boolean;
      /** Stops waiting (the payment itself is not cancelled). */
      signal?: AbortSignal;
    },
  ): Promise<Payment> {
    const {
      onPaymentCreated,
      onStatusUpdate,
      pollInterval = 5000,
      timeout = 180_000,
      maxChecks = 20,
      acceptClaimed = false,
      signal,
    } = options || {};

    const payment = await this.createPayment(params);
    onPaymentCreated?.(payment);

    const deadline = Date.now() + timeout;
    let wait = Math.max(pollInterval, 1000);
    let last: Payment | null = null;

    for (let check = 0; check < maxChecks; check++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0 || signal?.aborted) break;
      await sleep(Math.min(wait, remaining), signal);
      if (signal?.aborted) break;
      wait = Math.min(wait * 1.5, 30_000);

      last = await this.getStatus(payment.id);
      onStatusUpdate?.(last);
      if (last.status === "verified" || last.status === "expired" || last.status === "cancelled") return last;
      if (acceptClaimed && last.status === "claimed") return last;
    }

    return last ?? this.getStatus(payment.id);
  }
}

/** setTimeout as a promise that settles early (and clears its timer) on abort. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
  });
}

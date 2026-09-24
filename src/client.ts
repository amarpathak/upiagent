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
   * Wait for payment verification with polling.
   * Creates payment, then polls verify + getStatus until verified or timeout.
   *
   * @param params - Payment params
   * @param options - Polling options
   * @returns Payment object with final status
   */
  async createAndWaitForPayment(
    params: CreatePaymentParams,
    options?: {
      /** Called with payment after creation (show QR here) */
      onPaymentCreated?: (payment: Payment) => void;
      /** Called on each poll with current status */
      onStatusUpdate?: (status: Payment) => void;
      /** Polling interval in ms (default: 5000) */
      pollInterval?: number;
      /** Timeout in ms (default: 180000 = 3 min) */
      timeout?: number;
      /** Delay before first verify in ms (default: 10000) */
      initialDelay?: number;
    },
  ): Promise<Payment> {
    const {
      onPaymentCreated,
      onStatusUpdate,
      pollInterval = 5000,
      timeout = 180_000,
      initialDelay = 10_000,
    } = options || {};

    const payment = await this.createPayment(params);
    onPaymentCreated?.(payment);

    // Wait for customer to pay
    await new Promise((r) => setTimeout(r, initialDelay));

    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      // Trigger verification
      try {
        const result = await this.verify(payment.id);
        if (result.verified) {
          const final = await this.getStatus(payment.id);
          onStatusUpdate?.(final);
          return final;
        }
      } catch {
        // verify can fail transiently, keep polling
      }

      // Check status
      const status = await this.getStatus(payment.id);
      onStatusUpdate?.(status);

      // `claimed` keeps polling: it is only screenshot-backed until bank
      // evidence upgrades it to `verified`.
      if (status.status === "verified") return status;
      if (status.status === "expired" || status.status === "cancelled") return status;

      await new Promise((r) => setTimeout(r, pollInterval));
    }

    // Timed out — return last status
    return this.getStatus(payment.id);
  }
}

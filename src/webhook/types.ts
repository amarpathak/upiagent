// Payload shape lives in the shared contracts so senders, receivers and the
// docs cannot drift apart.
export type { WebhookEvent, WebhookPayload } from "../contracts/index.js";

export interface WebhookDeliveryResult {
  delivered: boolean;
  attempts: number;
  responseStatus?: number;
  error?: string;
}

export interface WebhookConfig {
  url: string;
  secret: string;
}

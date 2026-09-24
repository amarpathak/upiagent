import type { EmailMessage } from "../gmail/types.js";

/** What an incoming bank/UPI email is about. Only `credit` is ever verified. */
export const EMAIL_KINDS = ["credit", "debit", "otp", "statement", "promotional", "other"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export interface EmailClassification {
  /** Most likely kind. */
  kind: EmailKind;
  /** Probability that the email reports money received — the only kind worth an LLM call. */
  creditProbability: number;
  /**
   * Probability the email is forged, or carries text aimed at steering an
   * automated reader. A signal only: it lowers confidence, never verifies.
   * `null` when the classifier cannot judge this (rules).
   */
  suspicionProbability: number | null;
  /** Which classifier produced this. */
  source: "jev" | "rules";
  /** Token usage, when the classifier is a metered model. */
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * Cheap pre-screen that runs before the (expensive) extraction LLM.
 *
 * It decides only whether extraction is worth paying for. It never decides
 * that a payment happened — amount, UTR, time window and dedup stay in
 * deterministic code, because email bodies are attacker-influenced.
 */
export interface EmailClassifier {
  readonly name: string;
  classify(email: EmailMessage): Promise<EmailClassification>;
}

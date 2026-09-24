import type { EmailMessage } from "../gmail/types.js";
import { shouldSkipLlm } from "../security/bank-registry.js";
import type { EmailClassification, EmailClassifier } from "./types.js";

/**
 * Zero-cost classifier built on the sender registry and credit/debit regexes.
 * Always available, and the fallback whenever a model classifier fails.
 */
export class RulesClassifier implements EmailClassifier {
  readonly name = "rules";

  async classify(email: EmailMessage): Promise<EmailClassification> {
    const worthExtracting = !shouldSkipLlm(email.from, email.body);
    return {
      kind: worthExtracting ? "credit" : "other",
      // Rules are binary: 1 means "let the LLM look", 0 means "skip".
      creditProbability: worthExtracting ? 1 : 0,
      suspicionProbability: null,
      source: "rules",
    };
  }
}

-- Add LLM usage columns to verification_evidence for billing and merchant dashboard

ALTER TABLE verification_evidence ADD COLUMN IF NOT EXISTS llm_input_tokens INTEGER DEFAULT 0;
ALTER TABLE verification_evidence ADD COLUMN IF NOT EXISTS llm_output_tokens INTEGER DEFAULT 0;
ALTER TABLE verification_evidence ADD COLUMN IF NOT EXISTS llm_total_tokens INTEGER DEFAULT 0;
ALTER TABLE verification_evidence ADD COLUMN IF NOT EXISTS llm_call_count INTEGER DEFAULT 0;

-- Index for billing queries: aggregate token usage per merchant over time
CREATE INDEX IF NOT EXISTS idx_verification_evidence_payment
  ON verification_evidence(payment_id);

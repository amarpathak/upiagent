-- Add llm_model column and monthly usage limit to merchants

ALTER TABLE merchants ADD COLUMN IF NOT EXISTS llm_model text DEFAULT 'gemini-2.0-flash';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS monthly_token_limit integer DEFAULT 100000;

-- Index for monthly usage aggregation queries
CREATE INDEX IF NOT EXISTS idx_evidence_created_at
  ON verification_evidence(created_at);

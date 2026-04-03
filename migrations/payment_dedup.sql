CREATE TABLE IF NOT EXISTS payment_dedup (
  reference_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_dedup_expires_at
  ON payment_dedup (expires_at);

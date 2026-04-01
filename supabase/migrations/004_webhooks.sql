-- Webhook support: merchant config + delivery tracking

-- Merchant webhook configuration
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- Webhook delivery tracking (for audit and retry)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id),
  payment_id TEXT NOT NULL,
  event TEXT NOT NULL,
  delivery_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  response_status INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_payment ON webhook_deliveries(payment_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status) WHERE status = 'pending';

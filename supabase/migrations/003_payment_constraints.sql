-- 003_payment_constraints.sql
-- Prevents cross-payment replay attacks (same bank alert verifying multiple payments)
-- and enforces valid payment status values.

-- Unique constraint on upi_reference_id (partial: only non-null values)
-- Fixes HIGH-001: same bank email can't verify multiple payments
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_upi_ref_unique
  ON payments(upi_reference_id)
  WHERE upi_reference_id IS NOT NULL;

-- Check constraint on payment status
-- Fixes LOW-001: status was unconstrained free text
ALTER TABLE payments
  ADD CONSTRAINT chk_payment_status
  CHECK (status IN ('pending', 'verified', 'expired'));

-- Prevent duplicate evidence rows from concurrent verify requests
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_payment_source
  ON verification_evidence(payment_id, source)
  WHERE extracted_upi_ref IS NOT NULL;

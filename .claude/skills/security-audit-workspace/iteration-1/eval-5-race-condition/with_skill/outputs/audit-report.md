# Race Condition Security Audit — With Skill

## Findings

### CRITICAL-001: Dashboard verify route TOCTOU race condition
- **Category**: Payment Integrity
- **Location**: `apps/dashboard/src/app/api/verify/route.ts:149-334`
- **Description**: Classic TOCTOU (time-of-check-to-time-of-use) race. Reads `payment.status` at line 149, runs a multi-second async pipeline (Gmail + LLM), then writes `status: "verified"` at lines 323-334 with a plain `UPDATE ... WHERE id = paymentId` — no conditional on current status. Two concurrent requests both see "pending" and both write "verified".
- **Impact**: Double-counting of payments. Zero dedup logic in this route. The `dedup_check: true` at line 308 is hardcoded, not a real check.
- **Remediation**: Add `.eq("status", "pending")` to the UPDATE query. Check affected row count — if 0, another request already verified it.

### HIGH-002: WWW demo verify route in-memory dedup is non-atomic
- **Category**: Payment Integrity
- **Location**: `apps/www/src/app/api/verify/route.ts:330-339`
- **Description**: In-memory dedup (`isDuplicateRef` at line 330, `markRefUsed` at line 339) but these are non-atomic. On Vercel serverless, the in-memory `Map` is not shared across isolates.
- **Impact**: Dedup effectively non-existent in production serverless deployment.
- **Remediation**: Move dedup to database (UNIQUE constraint) or Redis.

### HIGH-003: No UNIQUE constraint on upi_reference_id
- **Category**: Database Security
- **Location**: `supabase/migrations/001_initial_schema.sql:57`
- **Description**: No UNIQUE constraint on `payments.upi_reference_id`, so the same bank alert can verify multiple different payments.
- **Impact**: Cross-payment replay — one bank email can verify multiple payments for the same amount.
- **Remediation**: Add `CREATE UNIQUE INDEX idx_payments_upi_ref_unique ON payments(upi_reference_id) WHERE upi_reference_id IS NOT NULL;`

### MEDIUM-004: Hardcoded dedup_check in evidence records
- **Category**: Payment Integrity
- **Location**: `apps/dashboard/src/app/api/verify/route.ts:308`
- **Description**: `dedup_check: true` is hardcoded in evidence records, not a real check.
- **Impact**: Misleading audit trail — evidence says dedup passed when no dedup was performed.

### MEDIUM-005: In-memory dedup lost on cold starts
- **Category**: Payment Integrity
- **Location**: `apps/www/src/app/api/verify/route.ts` (module-level Map)
- **Description**: The `verifiedRefs` Map is module-level state that resets on every cold start.
- **Impact**: Dedup protection is intermittent — works within a warm instance, lost on restart.

## Minimum Fix
Add `.eq("status", "pending")` to the UPDATE query on the dashboard route (one line) plus a UNIQUE partial index on `upi_reference_id` in the database.

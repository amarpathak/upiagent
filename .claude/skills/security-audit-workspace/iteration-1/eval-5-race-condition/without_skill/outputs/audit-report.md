# Race Condition Analysis — Without Skill

**Answer: Yes, concurrent verify requests can double-count. Multiple race conditions exist.**

## Dashboard route (`apps/dashboard/src/app/api/verify/route.ts`) — HIGH severity

- Classic TOCTOU: status is read at line 133, but not updated until line 323. The gap includes multiple Gmail API calls and a Gemini LLM call (seconds of latency).
- The update (`.update().eq("id", paymentId)`) has no conditional check on `status = "pending"`, so both concurrent requests succeed.
- No dedup logic whatsoever — unlike the www route, there is no `verifiedRefs` map.
- Each request inserts its own `verification_evidence` row, creating duplicate records.
- No `UNIQUE` constraint on `upi_reference_id` in the `payments` table, enabling cross-payment replay (one bank email can verify multiple payments for the same amount).

## WWW/Demo route (`apps/www/src/app/api/verify/route.ts`) — MEDIUM severity

- Has in-memory dedup via a `Map<string, number>`, but this is wiped on every serverless cold start and not shared across Vercel isolates.
- The `isDuplicateRef` / `markRefUsed` sequence is a TOCTOU bug (though mitigated by Node.js single-threading within one isolate).
- No database persistence of dedup state at all.

## Database schema (`supabase/migrations/001_initial_schema.sql`)

- `payments.upi_reference_id` has no `UNIQUE` constraint.
- `verification_evidence` has no uniqueness constraint on `(payment_id, extracted_upi_ref)`.
- `payments.status` is unconstrained `text` with no check constraint.

## Key fixes needed

- Conditional update (`WHERE status = 'pending'` + check affected row count)
- Unique constraint on UPI reference per merchant
- Database-backed dedup instead of in-memory maps

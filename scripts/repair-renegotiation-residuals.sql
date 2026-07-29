-- One-time reconciliation repair for AR renegotiation residuals.
--
-- Context: before the fix in charge.repository.createPlan, superseding a plan retained a
-- *partially-paid* installment at its FULL amount, leaving a residual balance. That residual is
-- already carried by the new plan, so the installment-sum outstanding path (Account / Statement /
-- Collections) double-counted it against the charge's net−paid path — e.g. Account 753.219 vs
-- Charge 752.889 on a 1,905.000 charge.
--
-- This script shrinks every such residual installment to exactly what was paid (status PAID,
-- zero balance), restoring the invariant  Σ(non-cancelled installment.amount) == charge.net  and
-- making all outstanding views identical to the fils. It is idempotent and safe to re-run: it only
-- touches installments that are NOT on the charge's current ACTIVE plan and are strictly partially
-- paid (0 < paid < amount). Installments on the active schedule are never modified.
--
-- Run as a role that can see all tenants (platform/admin), inside a transaction. Review the SELECT
-- preview first, then run the UPDATE.

BEGIN;

WITH active_plan AS (
  SELECT "chargeId", id AS active_plan_id
  FROM "PaymentPlan"
  WHERE status = 'ACTIVE'
),
paid AS (
  SELECT "installmentId", COALESCE(SUM(amount), 0) AS paid
  FROM "PaymentAllocation"
  WHERE "reversedAt" IS NULL
  GROUP BY "installmentId"
)
-- PREVIEW: rows that will be repaired (residual = amount − paid).
SELECT
  i.id,
  i."chargeId",
  i."planId",
  i.amount            AS current_amount,
  p.paid              AS paid,
  (i.amount - p.paid) AS residual_removed
FROM "Installment" i
JOIN active_plan ap ON ap."chargeId" = i."chargeId"
JOIN paid p         ON p."installmentId" = i.id
WHERE i.status <> 'CANCELLED'
  AND i."planId" IS DISTINCT FROM ap.active_plan_id  -- not the current active schedule
  AND p.paid > 0
  AND p.paid < i.amount
ORDER BY residual_removed DESC;

WITH active_plan AS (
  SELECT "chargeId", id AS active_plan_id
  FROM "PaymentPlan"
  WHERE status = 'ACTIVE'
),
paid AS (
  SELECT "installmentId", COALESCE(SUM(amount), 0) AS paid
  FROM "PaymentAllocation"
  WHERE "reversedAt" IS NULL
  GROUP BY "installmentId"
)
UPDATE "Installment" i
SET amount = p.paid,
    status = 'PAID'
FROM active_plan ap, paid p
WHERE i."chargeId" = ap."chargeId"
  AND i.id = p."installmentId"
  AND i.status <> 'CANCELLED'
  AND i."planId" IS DISTINCT FROM ap.active_plan_id
  AND p.paid > 0
  AND p.paid < i.amount;

-- Inspect the row counts above, then:  COMMIT;   (or  ROLLBACK;  to abort)
COMMIT;

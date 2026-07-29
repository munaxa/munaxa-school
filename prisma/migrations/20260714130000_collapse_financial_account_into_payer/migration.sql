-- Collapse the FinancialAccount table into Payer (the canonical Financial Account).
--
-- Payer already grouped a guardian's students (siblings share one Payer) and every ledger row
-- already references it via payerId (Payment/Credit/Refund/StudentFinancialAccount), so the separate
-- FinancialAccount table (added days earlier, never used in production — it caused a startup crash)
-- was redundant. This extends Payer with the account attributes, repoints the account payment plan to
-- payerId, replaces Payment.financialAccountId with an accountScoped marker, and drops the redundant
-- FinancialAccount table + the parallel financialAccountId columns. No historical data migration:
-- existing student billing keeps working through the unchanged payerId links.

-- 1) Extend Payer into the Financial Account.
ALTER TABLE "Payer" ADD COLUMN "ownerType" "FinancialAccountOwnerType" NOT NULL DEFAULT 'GUARDIAN';
ALTER TABLE "Payer" ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Payer" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'JOD';
ALTER TABLE "Payer" ADD COLUMN "nationalId" TEXT;
ALTER TABLE "Payer" ADD COLUMN "taxId" TEXT;
CREATE INDEX "Payer_tenantId_status_idx" ON "Payer"("tenantId", "status");

-- 2) Payment: replace financialAccountId with the accountScoped allocation marker.
DROP INDEX IF EXISTS "Payment_tenantId_financialAccountId_idx";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "financialAccountId"; -- drops its FK + column
ALTER TABLE "Payment" ADD COLUMN "accountScoped" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Payment_tenantId_payerId_idx" ON "Payment"("tenantId", "payerId");

-- 3) Drop the parallel financialAccountId columns on the ledger tables (reuse existing payerId).
DROP INDEX IF EXISTS "Credit_tenantId_financialAccountId_idx";
ALTER TABLE "Credit" DROP COLUMN IF EXISTS "financialAccountId";
DROP INDEX IF EXISTS "Refund_tenantId_financialAccountId_idx";
ALTER TABLE "Refund" DROP COLUMN IF EXISTS "financialAccountId";
DROP INDEX IF EXISTS "StudentFinancialAccount_tenantId_financialAccountId_idx";
ALTER TABLE "StudentFinancialAccount" DROP COLUMN IF EXISTS "financialAccountId";

-- 4) Repoint the account payment plan to the Payer (Financial Account). The table is new and empty
--    in production, so replacing the column is safe.
DROP INDEX IF EXISTS "FinancialAccountPlan_tenantId_financialAccountId_idx";
ALTER TABLE "FinancialAccountPlan" DROP COLUMN "financialAccountId";
ALTER TABLE "FinancialAccountPlan" ADD COLUMN "payerId" UUID NOT NULL;
CREATE INDEX "FinancialAccountPlan_tenantId_payerId_idx" ON "FinancialAccountPlan"("tenantId", "payerId");
ALTER TABLE "FinancialAccountPlan"
  ADD CONSTRAINT "FinancialAccountPlan_payerId_fkey"
  FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) Drop the redundant FinancialAccount table (RLS policy + FKs drop with it).
DROP TABLE IF EXISTS "FinancialAccount";

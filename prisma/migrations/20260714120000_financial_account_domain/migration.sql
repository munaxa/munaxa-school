-- Family / Financial-Account billing (additive, backward-compatible).
--   Introduces the FinancialAccount (the financial customer that pays for one or more students'
--   services) and FinancialAccountPlan (the family/customer-level installment plan). Students keep
--   owning their charges/discounts/scholarships; a FinancialAccount owns the payment plan, payments,
--   credits, refunds and agreements. The allocation engine is unchanged — it still settles individual
--   student-charge installments.
--
--   Every column added to an existing table is NULLABLE with no backfill, so existing student-only
--   billing keeps working exactly as before (financial* columns stay NULL). No historical data is
--   migrated. Fully reversible.

-- CreateEnum
CREATE TYPE "FinancialAccountOwnerType" AS ENUM (
  'GUARDIAN', 'GRANDPARENT', 'COMPANY', 'CHARITY', 'SPONSOR',
  'GOVERNMENT', 'SCHOLARSHIP_ORG', 'COURT_ORDER', 'RELATIVE', 'OTHER'
);

-- CreateTable: FinancialAccount
CREATE TABLE "FinancialAccount" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ownerType" "FinancialAccountOwnerType" NOT NULL DEFAULT 'GUARDIAN',
    "parentId" UUID,
    "payerId" UUID,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialAccount_tenantId_idx" ON "FinancialAccount"("tenantId");
CREATE INDEX "FinancialAccount_tenantId_parentId_idx" ON "FinancialAccount"("tenantId", "parentId");
CREATE INDEX "FinancialAccount_tenantId_payerId_idx" ON "FinancialAccount"("tenantId", "payerId");

-- CreateTable: FinancialAccountPlan
CREATE TABLE "FinancialAccountPlan" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "financialAccountId" UUID NOT NULL,
    "academicYearId" UUID NOT NULL,
    "cadence" "PaymentPlanCadence" NOT NULL DEFAULT 'MONTHLY',
    "installments" INTEGER NOT NULL,
    "firstDueDate" DATE NOT NULL,
    "status" "PaymentPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "FinancialAccountPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialAccountPlan_tenantId_financialAccountId_idx" ON "FinancialAccountPlan"("tenantId", "financialAccountId");
CREATE INDEX "FinancialAccountPlan_tenantId_status_idx" ON "FinancialAccountPlan"("tenantId", "status");

-- AlterTable: additive nullable FKs on the existing AR tables
ALTER TABLE "StudentFinancialAccount" ADD COLUMN "financialAccountId" UUID;
ALTER TABLE "PaymentPlan" ADD COLUMN "financialPlanId" UUID;
ALTER TABLE "Payment" ADD COLUMN "financialAccountId" UUID;
ALTER TABLE "Credit" ADD COLUMN "financialAccountId" UUID;
ALTER TABLE "Refund" ADD COLUMN "financialAccountId" UUID;

CREATE INDEX "StudentFinancialAccount_tenantId_financialAccountId_idx" ON "StudentFinancialAccount"("tenantId", "financialAccountId");
CREATE INDEX "PaymentPlan_tenantId_financialPlanId_idx" ON "PaymentPlan"("tenantId", "financialPlanId");
CREATE INDEX "Payment_tenantId_financialAccountId_idx" ON "Payment"("tenantId", "financialAccountId");
CREATE INDEX "Credit_tenantId_financialAccountId_idx" ON "Credit"("tenantId", "financialAccountId");
CREATE INDEX "Refund_tenantId_financialAccountId_idx" ON "Refund"("tenantId", "financialAccountId");

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinancialAccountPlan" ADD CONSTRAINT "FinancialAccountPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialAccountPlan" ADD CONSTRAINT "FinancialAccountPlan_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialAccountPlan" ADD CONSTRAINT "FinancialAccountPlan_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentFinancialAccount" ADD CONSTRAINT "StudentFinancialAccount_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_financialPlanId_fkey" FOREIGN KEY ("financialPlanId") REFERENCES "FinancialAccountPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security: tenant isolation on the new tables (same helpers/pattern as the AR domain).
-- Runtime role privileges are granted centrally by infra/postgres/app-role.sql after migrations.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['FinancialAccount', 'FinancialAccountPlan'];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING ("tenantId" = app_current_tenant() OR app_is_platform())
        WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform())
    $f$, t);
  END LOOP;
END $$;

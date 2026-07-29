-- Enrollment & Billing — Configuration layer (Phase 1).
-- Additive, tenant-scoped fee/discount/transport/policy configuration. RLS enabled
-- (fail-closed) consistent with 20260616120000_finance_presence_rls.

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('FULL_PAYMENT', 'SIBLING', 'SCHOLARSHIP', 'PROMOTIONAL', 'MANUAL');
CREATE TYPE "DiscountCalc" AS ENUM ('FIXED', 'PERCENT');
CREATE TYPE "TransportDirection" AS ENUM ('NONE', 'ONE_WAY', 'TWO_WAY');

-- CreateTable
CREATE TABLE "GradeFeeSchedule" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "gradeId" UUID NOT NULL,
  "academicYearId" UUID NOT NULL,
  "registrationFee" DECIMAL(12,3) NOT NULL,
  "tuitionFee" DECIMAL(12,3) NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID,
  "updatedById" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "GradeFeeSchedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GradeFeeSchedule_tenantId_academicYearId_gradeId_idx" ON "GradeFeeSchedule"("tenantId", "academicYearId", "gradeId");
CREATE INDEX "GradeFeeSchedule_tenantId_isActive_idx" ON "GradeFeeSchedule"("tenantId", "isActive");

CREATE TABLE "TransportFare" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "academicYearId" UUID NOT NULL,
  "direction" "TransportDirection" NOT NULL,
  "amount" DECIMAL(12,3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID,
  "updatedById" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "TransportFare_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TransportFare_tenantId_academicYearId_direction_key" ON "TransportFare"("tenantId", "academicYearId", "direction");
CREATE INDEX "TransportFare_tenantId_academicYearId_idx" ON "TransportFare"("tenantId", "academicYearId");

CREATE TABLE "DiscountRule" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" "DiscountType" NOT NULL,
  "calc" "DiscountCalc" NOT NULL,
  "value" DECIMAL(12,3) NOT NULL,
  "maxAmount" DECIMAL(12,3),
  "appliesToTransport" BOOLEAN NOT NULL DEFAULT false,
  "startDate" DATE,
  "endDate" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID,
  "updatedById" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "DiscountRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DiscountRule_tenantId_isActive_idx" ON "DiscountRule"("tenantId", "isActive");
CREATE INDEX "DiscountRule_tenantId_type_idx" ON "DiscountRule"("tenantId", "type");

CREATE TABLE "BillingPolicy" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "minInstallments" INTEGER NOT NULL DEFAULT 1,
  "maxInstallments" INTEGER NOT NULL DEFAULT 9,
  "fullPaymentDiscountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "suspendTransportAfterOverdue" INTEGER NOT NULL DEFAULT 2,
  "createdById" UUID,
  "updatedById" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "BillingPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingPolicy_tenantId_key" ON "BillingPolicy"("tenantId");

-- AddForeignKey
ALTER TABLE "GradeFeeSchedule" ADD CONSTRAINT "GradeFeeSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradeFeeSchedule" ADD CONSTRAINT "GradeFeeSchedule_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradeFeeSchedule" ADD CONSTRAINT "GradeFeeSchedule_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransportFare" ADD CONSTRAINT "TransportFare_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransportFare" ADD CONSTRAINT "TransportFare_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingPolicy" ADD CONSTRAINT "BillingPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (fail-closed tenant isolation; see 20260616120000_finance_presence_rls)
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['GradeFeeSchedule', 'TransportFare', 'DiscountRule', 'BillingPolicy'];
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

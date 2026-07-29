-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('SCHOLARSHIP', 'DISCOUNT', 'SIBLING_DISCOUNT', 'STAFF_DISCOUNT', 'WAIVER', 'CREDIT_MEMO', 'CORRECTION');

-- CreateEnum
CREATE TYPE "AdjustmentStatus" AS ENUM ('APPLIED', 'REVERSED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "FeeAdjustment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "chargeId" UUID,
    "type" "AdjustmentType" NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "percent" DECIMAL(5,2),
    "reason" TEXT NOT NULL,
    "status" "AdjustmentStatus" NOT NULL DEFAULT 'APPLIED',
    "createdById" UUID,
    "reversedById" UUID,
    "reversedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "FeeAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "chargeId" UUID NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "createdById" UUID,
    "reversedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "recordedById" UUID,
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMPTZ(6),
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeeAdjustment_tenantId_studentId_idx" ON "FeeAdjustment"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "FeeAdjustment_tenantId_chargeId_idx" ON "FeeAdjustment"("tenantId", "chargeId");

-- CreateIndex
CREATE INDEX "FeeAdjustment_tenantId_status_idx" ON "FeeAdjustment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PaymentAllocation_tenantId_transactionId_idx" ON "PaymentAllocation"("tenantId", "transactionId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_tenantId_chargeId_idx" ON "PaymentAllocation"("tenantId", "chargeId");

-- CreateIndex
CREATE INDEX "Refund_tenantId_studentId_idx" ON "Refund"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "Refund_tenantId_status_idx" ON "Refund"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "FeeAdjustment" ADD CONSTRAINT "FeeAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAdjustment" ADD CONSTRAINT "FeeAdjustment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAdjustment" ADD CONSTRAINT "FeeAdjustment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ============================================================================
-- Tenant isolation (RLS) for the billing-ledger tables — same pattern as every module.
-- ============================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['FeeAdjustment','PaymentAllocation','Refund']
  LOOP
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

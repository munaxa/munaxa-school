-- CreateEnum
CREATE TYPE "CollectionsStatus" AS ENUM ('NONE', 'FINANCIAL_ISSUE', 'LEGAL');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('IN_APP', 'SMS');

-- CreateTable
CREATE TABLE "StudentBillingProfile" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "collectionsStatus" "CollectionsStatus" NOT NULL DEFAULT 'NONE',
    "legalNote" TEXT,
    "flaggedById" UUID,
    "flaggedAt" TIMESTAMPTZ(6),
    "lastReminderAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StudentBillingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReminder" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "channels" "ReminderChannel"[],
    "outstanding" DECIMAL(12,3) NOT NULL,
    "dueThisMonth" DECIMAL(12,3) NOT NULL,
    "overdue" DECIMAL(12,3) NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "smsSentCount" INTEGER NOT NULL DEFAULT 0,
    "sentById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentBillingProfile_studentId_key" ON "StudentBillingProfile"("studentId");

-- CreateIndex
CREATE INDEX "StudentBillingProfile_tenantId_collectionsStatus_idx" ON "StudentBillingProfile"("tenantId", "collectionsStatus");

-- CreateIndex
CREATE INDEX "PaymentReminder_tenantId_studentId_idx" ON "PaymentReminder"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "PaymentReminder_tenantId_createdAt_idx" ON "PaymentReminder"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "StudentBillingProfile" ADD CONSTRAINT "StudentBillingProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBillingProfile" ADD CONSTRAINT "StudentBillingProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ============================================================================
-- Tenant isolation (RLS) for the fee-collections tables — same pattern as every module.
-- ============================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['StudentBillingProfile','PaymentReminder']
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

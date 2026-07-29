-- Billing-responsibility transfer (PR #212 review) — a dedicated financial business event behind
-- changing the legal payer of a StudentFinancialAccount. Additive; scalar tenant scoping + RLS.

-- CreateEnum
CREATE TYPE "BillingResponsibilityReason" AS ENUM (
  'PARENT_REQUEST', 'COURT_ORDER', 'SECRETARY_CORRECTION', 'DUPLICATE_ADMISSION_CORRECTION', 'OTHER'
);

-- CreateTable
CREATE TABLE "BillingResponsibilityTransfer" (
  "id"                        UUID NOT NULL,
  "tenantId"                  UUID NOT NULL,
  "studentFinancialAccountId" UUID NOT NULL,
  "studentId"                 UUID NOT NULL,
  "fromPayerId"               UUID,
  "toPayerId"                 UUID NOT NULL,
  "reason"                    "BillingResponsibilityReason" NOT NULL,
  "notes"                     TEXT,
  "performedById"             UUID,
  "performedAt"               TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingResponsibilityTransfer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BillingResponsibilityTransfer_tenantId_idx"
  ON "BillingResponsibilityTransfer"("tenantId");
CREATE INDEX "BillingResponsibilityTransfer_tenantId_studentFinancialAccou_idx"
  ON "BillingResponsibilityTransfer"("tenantId", "studentFinancialAccountId");
CREATE INDEX "BillingResponsibilityTransfer_tenantId_studentId_idx"
  ON "BillingResponsibilityTransfer"("tenantId", "studentId");

-- Row-Level Security (fail-closed tenant isolation).
ALTER TABLE "BillingResponsibilityTransfer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingResponsibilityTransfer" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "BillingResponsibilityTransfer";
CREATE POLICY tenant_isolation ON "BillingResponsibilityTransfer"
  USING ("tenantId" = app_current_tenant() OR app_is_platform())
  WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform());

-- CreateEnum
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BillingPaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'DISABLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubscriptionStatus" ADD VALUE 'READ_ONLY';
ALTER TYPE "SubscriptionStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "TenantSubscription" ADD COLUMN     "planVersionId" UUID;

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "billingEmail" TEXT,
    "countryCode" TEXT,
    "consolidatedBilling" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Organization_isArchived_idx" ON "Organization"("isArchived");

-- CreateTable
CREATE TABLE "PriceBook" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "currency" TEXT NOT NULL,
    "countryCode" TEXT,
    "monthlyPrice" INTEGER,
    "yearlyPrice" INTEGER,
    "setupFee" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMPTZ(6),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PriceBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "limits" JSONB NOT NULL,
    "featureCodes" TEXT[],
    "pricing" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureCatalog" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "defaultEnabled" BOOLEAN NOT NULL DEFAULT false,
    "enterpriseOnly" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "FeatureCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingInvoice" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMPTZ(6),
    "periodEnd" TIMESTAMPTZ(6),
    "dueDate" TIMESTAMPTZ(6),
    "issuedAt" TIMESTAMPTZ(6),
    "paidAt" TIMESTAMPTZ(6),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingInvoiceLine" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmount" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BillingInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPayment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "invoiceId" UUID,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "status" "BillingPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "externalRef" TEXT,
    "failureReason" TEXT,
    "paidAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingRefund" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "BillingPaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPaymentMethod" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "brand" TEXT,
    "last4" TEXT,
    "expMonth" INTEGER,
    "expYear" INTEGER,
    "externalRef" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BillingPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingContact" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BillingContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingTaxRate" (
    "id" UUID NOT NULL,
    "countryCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BillingTaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "eventTypes" TEXT[],
    "secret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" UUID NOT NULL,
    "endpointId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "responseStatus" INTEGER,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "PriceBook_planId_currency_countryCode_idx" ON "PriceBook"("planId", "currency", "countryCode");

-- CreateIndex
CREATE INDEX "PriceBook_planId_isActive_idx" ON "PriceBook"("planId", "isActive");

-- CreateIndex
CREATE INDEX "PlanVersion_planId_isCurrent_idx" ON "PlanVersion"("planId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_planId_version_key" ON "PlanVersion"("planId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureCatalog_code_key" ON "FeatureCatalog"("code");

-- CreateIndex
CREATE INDEX "FeatureCatalog_category_idx" ON "FeatureCatalog"("category");

-- CreateIndex
CREATE INDEX "BillingInvoice_tenantId_status_idx" ON "BillingInvoice"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BillingInvoice_status_dueDate_idx" ON "BillingInvoice"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "BillingInvoice_tenantId_number_key" ON "BillingInvoice"("tenantId", "number");

-- CreateIndex
CREATE INDEX "BillingInvoiceLine_invoiceId_idx" ON "BillingInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "BillingPayment_tenantId_status_idx" ON "BillingPayment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BillingPayment_status_idx" ON "BillingPayment"("status");

-- CreateIndex
CREATE INDEX "BillingRefund_tenantId_idx" ON "BillingRefund"("tenantId");

-- CreateIndex
CREATE INDEX "BillingRefund_paymentId_idx" ON "BillingRefund"("paymentId");

-- CreateIndex
CREATE INDEX "BillingPaymentMethod_tenantId_idx" ON "BillingPaymentMethod"("tenantId");

-- CreateIndex
CREATE INDEX "BillingContact_tenantId_idx" ON "BillingContact"("tenantId");

-- CreateIndex
CREATE INDEX "BillingTaxRate_countryCode_isActive_idx" ON "BillingTaxRate"("countryCode", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BillingTaxRate_countryCode_name_key" ON "BillingTaxRate"("countryCode", "name");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_tenantId_idx" ON "WebhookEndpoint"("tenantId");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_isActive_idx" ON "WebhookEndpoint"("isActive");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_status_idx" ON "WebhookDelivery"("endpointId", "status");

-- CreateIndex
CREATE INDEX "WebhookDelivery_eventType_createdAt_idx" ON "WebhookDelivery"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "Tenant_organizationId_idx" ON "Tenant"("organizationId");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBook" ADD CONSTRAINT "PriceBook_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoiceLine" ADD CONSTRAINT "BillingInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRefund" ADD CONSTRAINT "BillingRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "BillingPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPaymentMethod" ADD CONSTRAINT "BillingPaymentMethod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingContact" ADD CONSTRAINT "BillingContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "BillingResponsibilityTransfer_tenantId_studentFinancialAccou_id" RENAME TO "BillingResponsibilityTransfer_tenantId_studentFinancialAcco_idx";


-- ============================================================================
-- Row-Level Security (v2 tables)
-- ============================================================================

-- Global catalog: readable by any bound session; writable only by the platform plane.
DO $$
DECLARE
  t text;
  catalog_tables text[] := ARRAY['Organization', 'PriceBook', 'PlanVersion', 'FeatureCatalog', 'BillingTaxRate'];
BEGIN
  FOREACH t IN ARRAY catalog_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS catalog_read ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS catalog_write ON %I', t);
    EXECUTE format($f$
      CREATE POLICY catalog_read ON %I FOR SELECT
        USING (app_current_tenant() IS NOT NULL OR app_is_platform())
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY catalog_write ON %I FOR ALL
        USING (app_is_platform()) WITH CHECK (app_is_platform())
    $f$, t);
  END LOOP;
END $$;

-- Tenant-scoped tables (own the tenantId column). WebhookEndpoint has a nullable tenantId:
-- null-tenant (platform-global) rows are visible/writable only in the platform context.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'BillingInvoice', 'BillingPayment', 'BillingRefund',
    'BillingPaymentMethod', 'BillingContact', 'WebhookEndpoint'
  ];
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

-- Child tables without their own tenantId: scoped through the parent row.
ALTER TABLE "BillingInvoiceLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingInvoiceLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "BillingInvoiceLine";
CREATE POLICY tenant_isolation ON "BillingInvoiceLine"
  USING (EXISTS (SELECT 1 FROM "BillingInvoice" i WHERE i.id = "invoiceId"
                 AND (i."tenantId" = app_current_tenant() OR app_is_platform())))
  WITH CHECK (EXISTS (SELECT 1 FROM "BillingInvoice" i WHERE i.id = "invoiceId"
                 AND (i."tenantId" = app_current_tenant() OR app_is_platform())));

ALTER TABLE "WebhookDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookDelivery" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "WebhookDelivery";
CREATE POLICY tenant_isolation ON "WebhookDelivery"
  USING (EXISTS (SELECT 1 FROM "WebhookEndpoint" e WHERE e.id = "endpointId"
                 AND (e."tenantId" = app_current_tenant() OR app_is_platform())))
  WITH CHECK (EXISTS (SELECT 1 FROM "WebhookEndpoint" e WHERE e.id = "endpointId"
                 AND (e."tenantId" = app_current_tenant() OR app_is_platform())));

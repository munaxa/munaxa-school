-- CreateEnum
CREATE TYPE "EInvoiceEnvironment" AS ENUM ('SIMULATION', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "EInvoiceTaxpayerType" AS ENUM ('INCOME', 'SALES', 'SPECIAL');

-- CreateEnum
CREATE TYPE "EInvoiceDocType" AS ENUM ('INVOICE', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "EInvoicePaymentKind" AS ENUM ('CASH', 'RECEIVABLE');

-- CreateEnum
CREATE TYPE "EInvoiceDocStatus" AS ENUM ('DRAFT', 'QUEUED', 'SUBMITTING', 'ACCEPTED', 'REJECTED', 'DEAD_LETTER', 'CANCELLED');

-- CreateTable
CREATE TABLE "EInvoiceSettings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'jofotara',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "environment" "EInvoiceEnvironment" NOT NULL DEFAULT 'SIMULATION',
    "endpointUrl" TEXT,
    "legalNameEn" TEXT,
    "legalNameAr" TEXT,
    "taxNumber" TEXT,
    "vatNumber" TEXT,
    "commercialRegistration" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'JO',
    "phone" TEXT,
    "email" TEXT,
    "taxpayerType" "EInvoiceTaxpayerType" NOT NULL DEFAULT 'INCOME',
    "vatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vatPercent" DECIMAL(5,2),
    "defaultTaxCategory" TEXT NOT NULL DEFAULT 'Z',
    "defaultPaymentKind" "EInvoicePaymentKind" NOT NULL DEFAULT 'RECEIVABLE',
    "fieldMappings" JSONB,
    "templateConfig" JSONB,
    "completedSteps" INTEGER NOT NULL DEFAULT 0,
    "lastTestAt" TIMESTAMPTZ(6),
    "lastTestOk" BOOLEAN,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "EInvoiceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EInvoiceCredential" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "settingsId" UUID NOT NULL,
    "clientId" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "secretHint" TEXT NOT NULL,
    "incomeSourceSequence" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "EInvoiceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EInvoiceCounter" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nextIcv" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "EInvoiceCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EInvoiceDocument" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "docType" "EInvoiceDocType" NOT NULL DEFAULT 'INVOICE',
    "paymentKind" "EInvoicePaymentKind" NOT NULL DEFAULT 'RECEIVABLE',
    "status" "EInvoiceDocStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceNumber" TEXT NOT NULL,
    "uuid" UUID NOT NULL,
    "icv" BIGINT,
    "chargeId" UUID,
    "transactionId" UUID,
    "studentId" UUID,
    "buyerName" TEXT,
    "buyerIdScheme" TEXT,
    "buyerIdValue" TEXT,
    "buyerPhone" TEXT,
    "buyerCity" TEXT,
    "originalDocumentId" UUID,
    "creditReason" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "taxExclusive" DECIMAL(12,3) NOT NULL,
    "taxAmount" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "payableAmount" DECIMAL(12,3) NOT NULL,
    "lines" JSONB NOT NULL,
    "submittedXml" TEXT,
    "signedInvoice" TEXT,
    "qrCode" TEXT,
    "providerUuid" TEXT,
    "validationResults" JSONB,
    "lastError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(6),
    "issuedAt" TIMESTAMPTZ(6),
    "acceptedAt" TIMESTAMPTZ(6),
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "EInvoiceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EInvoiceLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "detail" JSONB,
    "actorUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EInvoiceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EInvoiceSettings_tenantId_key" ON "EInvoiceSettings"("tenantId");

-- CreateIndex
CREATE INDEX "EInvoiceSettings_tenantId_idx" ON "EInvoiceSettings"("tenantId");

-- CreateIndex
CREATE INDEX "EInvoiceCredential_tenantId_idx" ON "EInvoiceCredential"("tenantId");

-- CreateIndex
CREATE INDEX "EInvoiceCredential_settingsId_idx" ON "EInvoiceCredential"("settingsId");

-- CreateIndex
CREATE UNIQUE INDEX "EInvoiceCounter_tenantId_key" ON "EInvoiceCounter"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "EInvoiceDocument_uuid_key" ON "EInvoiceDocument"("uuid");

-- CreateIndex
CREATE INDEX "EInvoiceDocument_tenantId_status_idx" ON "EInvoiceDocument"("tenantId", "status");

-- CreateIndex
CREATE INDEX "EInvoiceDocument_tenantId_createdAt_idx" ON "EInvoiceDocument"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "EInvoiceDocument_status_nextAttemptAt_idx" ON "EInvoiceDocument"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "EInvoiceDocument_tenantId_invoiceNumber_docType_key" ON "EInvoiceDocument"("tenantId", "invoiceNumber", "docType");

-- CreateIndex
CREATE INDEX "EInvoiceLog_tenantId_documentId_idx" ON "EInvoiceLog"("tenantId", "documentId");

-- CreateIndex
CREATE INDEX "EInvoiceLog_tenantId_createdAt_idx" ON "EInvoiceLog"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "EInvoiceSettings" ADD CONSTRAINT "EInvoiceSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceCredential" ADD CONSTRAINT "EInvoiceCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceCredential" ADD CONSTRAINT "EInvoiceCredential_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "EInvoiceSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceCounter" ADD CONSTRAINT "EInvoiceCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceDocument" ADD CONSTRAINT "EInvoiceDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceDocument" ADD CONSTRAINT "EInvoiceDocument_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceDocument" ADD CONSTRAINT "EInvoiceDocument_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceDocument" ADD CONSTRAINT "EInvoiceDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceDocument" ADD CONSTRAINT "EInvoiceDocument_originalDocumentId_fkey" FOREIGN KEY ("originalDocumentId") REFERENCES "EInvoiceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceLog" ADD CONSTRAINT "EInvoiceLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceLog" ADD CONSTRAINT "EInvoiceLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "EInvoiceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ============================================================================
-- Tenant isolation (RLS) for the e-invoicing tables — same pattern as every module:
-- FORCE RLS, tenant sees only its rows, platform plane sees all.
-- ============================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['EInvoiceSettings','EInvoiceCredential','EInvoiceCounter','EInvoiceDocument','EInvoiceLog']
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

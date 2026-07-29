-- ============================================================================
-- Enterprise Document Engine (Phase 23)
--   Reusable engine that generates every official school document (admissions
--   agreements + finance documents) from a permanent JSON snapshot, stores the
--   rendered PDF immutably (bytea), and archives + audits every print/download/
--   email. Consumes the existing ledger/admissions/organization data — it never
--   creates or duplicates any financial record.
--
-- Additive & backward compatible: four new enums + three new tenant-scoped
-- tables (all RLS-isolated). No existing table is altered.
-- ============================================================================

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM (
  'REGISTRATION_AGREEMENT',
  'PAYMENT_RECEIPT',
  'ANNUAL_TUITION_CERTIFICATE',
  'OUTSTANDING_BALANCE_CERTIFICATE',
  'CLEARANCE_CERTIFICATE',
  'ACCOUNT_STATEMENT',
  'PAYMENT_HISTORY',
  'FEE_BREAKDOWN',
  'STUDENT_FINANCIAL_SUMMARY'
);

-- CreateEnum
CREATE TYPE "DocumentLanguage" AS ENUM ('EN', 'AR', 'BILINGUAL');

-- CreateEnum
CREATE TYPE "GeneratedDocumentStatus" AS ENUM ('ARCHIVED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RegistrationAgreementStatus" AS ENUM (
  'DRAFT', 'COMMITTED', 'SIGNED', 'CANCELLED', 'ARCHIVED'
);

-- ----------------------------------------------------------------------------
-- DocumentSequence: gapless, per-tenant, per-scope counter (mirrors
-- FinanceReceiptCounter / EInvoiceCounter). scope = "AGREEMENT" or "DOC:<type>".
-- ----------------------------------------------------------------------------
CREATE TABLE "DocumentSequence" (
    "id"       UUID    NOT NULL,
    "tenantId" UUID    NOT NULL,
    "scope"    TEXT    NOT NULL,
    "nextNo"   INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentSequence_tenantId_scope_key"
  ON "DocumentSequence"("tenantId", "scope");

ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- GeneratedDocument: an immutable, archived official document. The rendered PDF
-- is stored in "pdf" (bytea) so reprints serve the exact stored snapshot.
-- ----------------------------------------------------------------------------
CREATE TABLE "GeneratedDocument" (
    "id"             UUID                      NOT NULL,
    "tenantId"       UUID                      NOT NULL,
    "documentNo"     INTEGER                   NOT NULL,
    "type"           "DocumentType"            NOT NULL,
    "title"          TEXT                      NOT NULL,
    "language"       "DocumentLanguage"        NOT NULL DEFAULT 'EN',
    "status"         "GeneratedDocumentStatus" NOT NULL DEFAULT 'ARCHIVED',
    "version"        INTEGER                   NOT NULL DEFAULT 1,
    "studentId"      UUID,
    "parentId"       UUID,
    "academicYearId" UUID,
    "enrollmentId"   UUID,
    "transactionId"  UUID,
    "dataSnapshot"   JSONB                     NOT NULL,
    "pdf"            BYTEA                     NOT NULL,
    "checksum"       TEXT                      NOT NULL,
    "byteSize"       INTEGER                   NOT NULL,
    "printedCount"   INTEGER                   NOT NULL DEFAULT 0,
    "lastPrintedAt"  TIMESTAMPTZ(6),
    "generatedById"  UUID,
    "generatedAt"    TIMESTAMPTZ(6)            NOT NULL DEFAULT now(),
    "createdAt"      TIMESTAMPTZ(6)            NOT NULL DEFAULT now(),
    "updatedAt"      TIMESTAMPTZ(6)            NOT NULL,

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GeneratedDocument_tenantId_type_documentNo_key"
  ON "GeneratedDocument"("tenantId", "type", "documentNo");
CREATE INDEX "GeneratedDocument_tenantId_type_idx"
  ON "GeneratedDocument"("tenantId", "type");
CREATE INDEX "GeneratedDocument_tenantId_studentId_idx"
  ON "GeneratedDocument"("tenantId", "studentId");
CREATE INDEX "GeneratedDocument_tenantId_generatedAt_idx"
  ON "GeneratedDocument"("tenantId", "generatedAt");

ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- RegistrationAgreement: the legal commitment, versioned & never overwritten.
-- ----------------------------------------------------------------------------
CREATE TABLE "RegistrationAgreement" (
    "id"                  UUID                          NOT NULL,
    "tenantId"            UUID                          NOT NULL,
    "agreementNo"         INTEGER                       NOT NULL,
    "version"             INTEGER                       NOT NULL DEFAULT 1,
    "status"              "RegistrationAgreementStatus" NOT NULL DEFAULT 'COMMITTED',
    "enrollmentId"        UUID                          NOT NULL,
    "studentId"           UUID                          NOT NULL,
    "parentId"            UUID,
    "academicYearId"      UUID                          NOT NULL,
    "campusId"            UUID,
    "gradeId"             UUID,
    "sectionId"           UUID,
    "registrationDate"    DATE                          NOT NULL,
    "paymentMode"         "QuotePaymentMode"            NOT NULL DEFAULT 'INSTALLMENTS',
    "installments"        INTEGER                       NOT NULL DEFAULT 1,
    "feeBreakdown"        JSONB                         NOT NULL,
    "installmentSchedule" JSONB                         NOT NULL,
    "grandTotal"          DECIMAL(12,3)                 NOT NULL,
    "documentId"          UUID,
    "supersedesId"        UUID,
    "registrarId"         UUID,
    "createdAt"           TIMESTAMPTZ(6)                NOT NULL DEFAULT now(),
    "updatedAt"           TIMESTAMPTZ(6)                NOT NULL,

    CONSTRAINT "RegistrationAgreement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationAgreement_documentId_key"
  ON "RegistrationAgreement"("documentId");
CREATE UNIQUE INDEX "RegistrationAgreement_tenantId_agreementNo_key"
  ON "RegistrationAgreement"("tenantId", "agreementNo");
CREATE UNIQUE INDEX "RegistrationAgreement_tenantId_enrollmentId_version_key"
  ON "RegistrationAgreement"("tenantId", "enrollmentId", "version");
CREATE INDEX "RegistrationAgreement_tenantId_studentId_idx"
  ON "RegistrationAgreement"("tenantId", "studentId");
CREATE INDEX "RegistrationAgreement_tenantId_enrollmentId_idx"
  ON "RegistrationAgreement"("tenantId", "enrollmentId");

ALTER TABLE "RegistrationAgreement" ADD CONSTRAINT "RegistrationAgreement_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationAgreement" ADD CONSTRAINT "RegistrationAgreement_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationAgreement" ADD CONSTRAINT "RegistrationAgreement_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationAgreement" ADD CONSTRAINT "RegistrationAgreement_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RegistrationAgreement" ADD CONSTRAINT "RegistrationAgreement_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationAgreement" ADD CONSTRAINT "RegistrationAgreement_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "GeneratedDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RegistrationAgreement" ADD CONSTRAINT "RegistrationAgreement_supersedesId_fkey"
  FOREIGN KEY ("supersedesId") REFERENCES "RegistrationAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- Tenant isolation (RLS). FORCE ROW LEVEL SECURITY; policy keys off
-- app_current_tenant()/app_is_platform() exactly like the rest of the schema.
-- ----------------------------------------------------------------------------
ALTER TABLE "DocumentSequence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentSequence" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "DocumentSequence";
CREATE POLICY tenant_isolation ON "DocumentSequence"
  USING ("tenantId" = app_current_tenant() OR app_is_platform())
  WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform());

ALTER TABLE "GeneratedDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GeneratedDocument" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "GeneratedDocument";
CREATE POLICY tenant_isolation ON "GeneratedDocument"
  USING ("tenantId" = app_current_tenant() OR app_is_platform())
  WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform());

ALTER TABLE "RegistrationAgreement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RegistrationAgreement" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RegistrationAgreement";
CREATE POLICY tenant_isolation ON "RegistrationAgreement"
  USING ("tenantId" = app_current_tenant() OR app_is_platform())
  WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform());

-- Admissions: registration, re-enrollment, quotation & payment planning (Phase 22).
-- Additive only. New enums, fee-item catalog, persisted quotes, per-year enrollment, fee
-- modification tracking + approvals, financial arrangements, registration commitments.
-- Extends BillingPolicy + StudentBillingProfile with new nullable/defaulted columns.

-- ── Enums ──
CREATE TYPE "FeeItemKind" AS ENUM ('REGISTRATION', 'TUITION', 'BOOKS', 'UNIFORM', 'INSURANCE', 'ACTIVITY', 'TECHNOLOGY', 'EXAM', 'LABORATORY', 'TRANSPORT', 'CUSTOM');
CREATE TYPE "EnrollmentStatus" AS ENUM ('QUOTED', 'PENDING_APPROVAL', 'COMMITTED', 'ACTIVE', 'CANCELLED');
CREATE TYPE "QuotePaymentMode" AS ENUM ('FULL', 'INSTALLMENTS');
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- ── BillingPolicy / StudentBillingProfile extensions ──
ALTER TABLE "BillingPolicy"
  ADD COLUMN "earlyRegistrationDiscountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "requireFinanceApprovalForFeeChanges" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "StudentBillingProfile"
  ADD COLUMN "feeModified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "customArrangement" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "financialNote" TEXT;

-- ── FeeItem ──
CREATE TABLE "FeeItem" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "kind" "FeeItemKind" NOT NULL DEFAULT 'CUSTOM',
  "nameEn" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "mandatory" BOOLEAN NOT NULL DEFAULT false,
  "discountable" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID,
  "updatedById" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "FeeItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FeeItem_tenantId_isActive_idx" ON "FeeItem"("tenantId", "isActive");
CREATE INDEX "FeeItem_tenantId_kind_idx" ON "FeeItem"("tenantId", "kind");

-- ── GradeFeeItem ──
CREATE TABLE "GradeFeeItem" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "feeItemId" UUID NOT NULL,
  "gradeId" UUID NOT NULL,
  "academicYearId" UUID NOT NULL,
  "amount" DECIMAL(12,3) NOT NULL,
  "mandatory" BOOLEAN NOT NULL DEFAULT false,
  "discountable" BOOLEAN NOT NULL DEFAULT false,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID,
  "updatedById" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "GradeFeeItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GradeFeeItem_tenantId_academicYearId_gradeId_idx" ON "GradeFeeItem"("tenantId", "academicYearId", "gradeId");
CREATE INDEX "GradeFeeItem_tenantId_isActive_idx" ON "GradeFeeItem"("tenantId", "isActive");

-- ── EnrollmentQuote ──
CREATE TABLE "EnrollmentQuote" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "academicYearId" UUID NOT NULL,
  "gradeId" UUID NOT NULL,
  "studentId" UUID,
  "transportDirection" "TransportDirection" NOT NULL DEFAULT 'NONE',
  "paymentMode" "QuotePaymentMode" NOT NULL DEFAULT 'INSTALLMENTS',
  "installments" INTEGER NOT NULL DEFAULT 1,
  "firstDueDate" DATE,
  "totalFees" DECIMAL(12,3) NOT NULL,
  "discountEligible" DECIMAL(12,3) NOT NULL,
  "discountAmount" DECIMAL(12,3) NOT NULL,
  "nonDiscountEligible" DECIMAL(12,3) NOT NULL,
  "grandTotal" DECIMAL(12,3) NOT NULL,
  "feeModified" BOOLEAN NOT NULL DEFAULT false,
  "createdById" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "EnrollmentQuote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EnrollmentQuote_tenantId_academicYearId_idx" ON "EnrollmentQuote"("tenantId", "academicYearId");
CREATE INDEX "EnrollmentQuote_tenantId_studentId_idx" ON "EnrollmentQuote"("tenantId", "studentId");

-- ── EnrollmentQuoteItem ──
CREATE TABLE "EnrollmentQuoteItem" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "quoteId" UUID NOT NULL,
  "feeItemId" UUID,
  "kind" "FeeItemKind" NOT NULL,
  "label" TEXT NOT NULL,
  "amount" DECIMAL(12,3) NOT NULL,
  "discountable" BOOLEAN NOT NULL DEFAULT false,
  "discountAmount" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "overridden" BOOLEAN NOT NULL DEFAULT false,
  "originalAmount" DECIMAL(12,3),
  "overrideReason" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnrollmentQuoteItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EnrollmentQuoteItem_tenantId_quoteId_idx" ON "EnrollmentQuoteItem"("tenantId", "quoteId");

-- ── Enrollment ──
CREATE TABLE "Enrollment" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "academicYearId" UUID NOT NULL,
  "gradeId" UUID NOT NULL,
  "sectionId" UUID,
  "quoteId" UUID,
  "transportDirection" "TransportDirection" NOT NULL DEFAULT 'NONE',
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'COMMITTED',
  "paymentMode" "QuotePaymentMode" NOT NULL DEFAULT 'INSTALLMENTS',
  "installmentPlanId" UUID,
  "feeModified" BOOLEAN NOT NULL DEFAULT false,
  "createdById" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Enrollment_quoteId_key" ON "Enrollment"("quoteId");
CREATE UNIQUE INDEX "Enrollment_tenantId_studentId_academicYearId_key" ON "Enrollment"("tenantId", "studentId", "academicYearId");
CREATE INDEX "Enrollment_tenantId_academicYearId_gradeId_idx" ON "Enrollment"("tenantId", "academicYearId", "gradeId");
CREATE INDEX "Enrollment_tenantId_status_idx" ON "Enrollment"("tenantId", "status");

-- ── FeeModification ──
CREATE TABLE "FeeModification" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "enrollmentId" UUID,
  "studentId" UUID,
  "field" TEXT NOT NULL,
  "originalValue" TEXT NOT NULL,
  "newValue" TEXT NOT NULL,
  "difference" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "modifiedById" UUID,
  "modifiedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeModification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FeeModification_tenantId_enrollmentId_idx" ON "FeeModification"("tenantId", "enrollmentId");
CREATE INDEX "FeeModification_tenantId_studentId_idx" ON "FeeModification"("tenantId", "studentId");

-- ── FeeModificationApproval ──
CREATE TABLE "FeeModificationApproval" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "modificationId" UUID NOT NULL,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "approverId" UUID,
  "note" TEXT,
  "decidedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeModificationApproval_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FeeModificationApproval_modificationId_key" ON "FeeModificationApproval"("modificationId");
CREATE INDEX "FeeModificationApproval_tenantId_status_idx" ON "FeeModificationApproval"("tenantId", "status");

-- ── FinancialArrangement ──
CREATE TABLE "FinancialArrangement" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "enrollmentId" UUID,
  "description" TEXT NOT NULL,
  "schedule" JSONB,
  "createdById" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "FinancialArrangement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FinancialArrangement_tenantId_studentId_idx" ON "FinancialArrangement"("tenantId", "studentId");

-- ── RegistrationCommitment ──
CREATE TABLE "RegistrationCommitment" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "enrollmentId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "receiptRef" TEXT,
  "committedById" UUID,
  "committedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegistrationCommitment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RegistrationCommitment_enrollmentId_key" ON "RegistrationCommitment"("enrollmentId");
CREATE UNIQUE INDEX "RegistrationCommitment_tenantId_idempotencyKey_key" ON "RegistrationCommitment"("tenantId", "idempotencyKey");
CREATE INDEX "RegistrationCommitment_tenantId_committedAt_idx" ON "RegistrationCommitment"("tenantId", "committedAt");

-- ── Foreign keys ──
ALTER TABLE "FeeItem" ADD CONSTRAINT "FeeItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradeFeeItem" ADD CONSTRAINT "GradeFeeItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradeFeeItem" ADD CONSTRAINT "GradeFeeItem_feeItemId_fkey" FOREIGN KEY ("feeItemId") REFERENCES "FeeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradeFeeItem" ADD CONSTRAINT "GradeFeeItem_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradeFeeItem" ADD CONSTRAINT "GradeFeeItem_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnrollmentQuote" ADD CONSTRAINT "EnrollmentQuote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnrollmentQuote" ADD CONSTRAINT "EnrollmentQuote_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnrollmentQuote" ADD CONSTRAINT "EnrollmentQuote_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnrollmentQuote" ADD CONSTRAINT "EnrollmentQuote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnrollmentQuoteItem" ADD CONSTRAINT "EnrollmentQuoteItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnrollmentQuoteItem" ADD CONSTRAINT "EnrollmentQuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "EnrollmentQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "EnrollmentQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeeModification" ADD CONSTRAINT "FeeModification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeeModification" ADD CONSTRAINT "FeeModification_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeeModificationApproval" ADD CONSTRAINT "FeeModificationApproval_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeeModificationApproval" ADD CONSTRAINT "FeeModificationApproval_modificationId_fkey" FOREIGN KEY ("modificationId") REFERENCES "FeeModification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialArrangement" ADD CONSTRAINT "FinancialArrangement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialArrangement" ADD CONSTRAINT "FinancialArrangement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialArrangement" ADD CONSTRAINT "FinancialArrangement_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RegistrationCommitment" ADD CONSTRAINT "RegistrationCommitment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationCommitment" ADD CONSTRAINT "RegistrationCommitment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Row-Level Security (fail-closed tenant isolation; see 20260616120000_finance_presence_rls) ──
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'FeeItem', 'GradeFeeItem', 'EnrollmentQuote', 'EnrollmentQuoteItem', 'Enrollment',
    'FeeModification', 'FeeModificationApproval', 'FinancialArrangement', 'RegistrationCommitment'
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

-- ── Seed canonical fee items for existing tenants (idempotent) ──
INSERT INTO "FeeItem" ("id", "tenantId", "kind", "nameEn", "nameAr", "mandatory", "discountable", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), t."id", v.kind::"FeeItemKind", v.en, v.ar, v.mand, v.disc, true, now(), now()
FROM "Tenant" t
CROSS JOIN (VALUES
  ('REGISTRATION', 'Registration fee', 'رسوم التسجيل', true,  false),
  ('TUITION',      'Tuition',          'الرسوم الدراسية', true,  true),
  ('TRANSPORT',    'Transportation',   'رسوم النقل',     false, false),
  ('BOOKS',        'Books',            'الكتب',          true,  false),
  ('UNIFORM',      'Uniform',          'الزي المدرسي',   true,  false),
  ('INSURANCE',    'Insurance',        'التأمين',         false, false),
  ('ACTIVITY',     'Activities',       'الأنشطة',         false, true),
  ('TECHNOLOGY',   'Technology',       'التقنية',         false, true)
) AS v(kind, en, ar, mand, disc)
WHERE NOT EXISTS (SELECT 1 FROM "FeeItem" f WHERE f."tenantId" = t."id");

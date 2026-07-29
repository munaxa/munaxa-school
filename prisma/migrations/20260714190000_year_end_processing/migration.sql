-- Student-Lifecycle refactor — Step 8 (Year-End Processing wizard, Decisions 9 & 10).
--
-- Adds the preview→confirm workflow tables. NOTHING in the enrollment/finance domain is created here
-- or by drafting decisions — only on Final Confirm (in application code). Additive, reversible; no
-- ledger change, no data backfill. Reverse by DROP TABLE the two tables + DROP TYPE the two enums.

-- CreateEnum
CREATE TYPE "YearEndProcessStatus" AS ENUM ('OPEN', 'COMMITTED', 'CANCELLED');
CREATE TYPE "YearEndAction" AS ENUM ('PROMOTE', 'REPEAT', 'GRADUATE', 'WITHDRAW', 'DECIDE_LATER');

-- CreateTable
CREATE TABLE "YearEndProcess" (
  "id"                   UUID NOT NULL,
  "tenantId"             UUID NOT NULL,
  "schoolId"             UUID NOT NULL,
  "sourceAcademicYearId" UUID NOT NULL,
  "targetAcademicYearId" UUID NOT NULL,
  "status"               "YearEndProcessStatus" NOT NULL DEFAULT 'OPEN',
  "createdById"          UUID,
  "committedById"        UUID,
  "committedAt"          TIMESTAMPTZ(6),
  "createdAt"            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "YearEndProcess_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "YearEndProcess_tenantId_status_idx" ON "YearEndProcess"("tenantId", "status");
CREATE INDEX "YearEndProcess_tenantId_schoolId_sourceAcademicYearId_idx"
  ON "YearEndProcess"("tenantId", "schoolId", "sourceAcademicYearId");

CREATE TABLE "YearEndDecision" (
  "id"                    UUID NOT NULL,
  "tenantId"              UUID NOT NULL,
  "processId"             UUID NOT NULL,
  "studentId"             UUID NOT NULL,
  "sourceEnrollmentId"    UUID NOT NULL,
  "action"                "YearEndAction" NOT NULL DEFAULT 'DECIDE_LATER',
  "targetGradeId"         UUID,
  "targetSectionId"       UUID,
  "targetClassroomId"     UUID,
  "reason"                TEXT,
  "needsReview"           BOOLEAN NOT NULL DEFAULT false,
  "reviewNote"            TEXT,
  "resultingEnrollmentId" UUID,
  "committedAt"           TIMESTAMPTZ(6),
  "createdAt"             TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "YearEndDecision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "YearEndDecision_processId_studentId_key"
  ON "YearEndDecision"("processId", "studentId");
CREATE INDEX "YearEndDecision_tenantId_processId_idx" ON "YearEndDecision"("tenantId", "processId");

-- AddForeignKey
ALTER TABLE "YearEndProcess" ADD CONSTRAINT "YearEndProcess_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "YearEndDecision" ADD CONSTRAINT "YearEndDecision_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "YearEndDecision" ADD CONSTRAINT "YearEndDecision_processId_fkey"
  FOREIGN KEY ("processId") REFERENCES "YearEndProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (fail-closed tenant isolation).
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['YearEndProcess', 'YearEndDecision'];
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

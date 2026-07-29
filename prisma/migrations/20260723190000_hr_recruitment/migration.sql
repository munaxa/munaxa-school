-- CreateEnum
CREATE TYPE "JobPostingStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'FILLED');

-- CreateEnum
CREATE TYPE "ApplicantStatus" AS ENUM ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "InterviewMode" AS ENUM ('ONSITE', 'PHONE', 'VIDEO');

-- CreateEnum
CREATE TYPE "InterviewOutcome" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateTable
CREATE TABLE "JobPosting" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "departmentId" UUID,
    "positionId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "employmentType" "EmploymentType",
    "location" TEXT,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "status" "JobPostingStatus" NOT NULL DEFAULT 'DRAFT',
    "openedAt" TIMESTAMPTZ(6),
    "closedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplicant" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "postingId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "resumeUrl" TEXT,
    "status" "ApplicantStatus" NOT NULL DEFAULT 'APPLIED',
    "rating" INTEGER,
    "notes" TEXT,
    "hiredEmployeeId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "JobApplicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "applicantId" UUID NOT NULL,
    "interviewerId" UUID,
    "scheduledAt" TIMESTAMPTZ(6) NOT NULL,
    "mode" "InterviewMode" NOT NULL DEFAULT 'ONSITE',
    "stage" TEXT,
    "outcome" "InterviewOutcome" NOT NULL DEFAULT 'PENDING',
    "rating" INTEGER,
    "feedback" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobPosting_tenantId_idx" ON "JobPosting"("tenantId");

-- CreateIndex
CREATE INDEX "JobPosting_tenantId_status_idx" ON "JobPosting"("tenantId", "status");

-- CreateIndex
CREATE INDEX "JobPosting_tenantId_departmentId_idx" ON "JobPosting"("tenantId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplicant_hiredEmployeeId_key" ON "JobApplicant"("hiredEmployeeId");

-- CreateIndex
CREATE INDEX "JobApplicant_tenantId_idx" ON "JobApplicant"("tenantId");

-- CreateIndex
CREATE INDEX "JobApplicant_tenantId_postingId_idx" ON "JobApplicant"("tenantId", "postingId");

-- CreateIndex
CREATE INDEX "JobApplicant_tenantId_status_idx" ON "JobApplicant"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Interview_tenantId_idx" ON "Interview"("tenantId");

-- CreateIndex
CREATE INDEX "Interview_tenantId_applicantId_idx" ON "Interview"("tenantId", "applicantId");

-- CreateIndex
CREATE INDEX "Interview_tenantId_scheduledAt_idx" ON "Interview"("tenantId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplicant" ADD CONSTRAINT "JobApplicant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplicant" ADD CONSTRAINT "JobApplicant_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplicant" ADD CONSTRAINT "JobApplicant_hiredEmployeeId_fkey" FOREIGN KEY ("hiredEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "JobApplicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- Tenant isolation (RLS) + runtime grants for the new tables.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['JobPosting', 'JobApplicant', 'Interview'];
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

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'munaxa_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "JobPosting", "JobApplicant", "Interview" TO munaxa_app;
  END IF;
END $$;

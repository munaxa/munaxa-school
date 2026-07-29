-- CreateEnum
CREATE TYPE "PerformanceCycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "PerformanceReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "PerformanceGoalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TrainingRecordStatus" AS ENUM ('ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PerformanceCycle" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "PerformanceCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "PerformanceCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceReview" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "reviewerId" UUID,
    "status" "PerformanceReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "overallRating" INTEGER,
    "summary" TEXT,
    "strengths" TEXT,
    "improvements" TEXT,
    "submittedAt" TIMESTAMPTZ(6),
    "acknowledgedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceGoal" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" "PerformanceGoalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "rating" INTEGER,
    "dueDate" DATE,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PerformanceGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingCourse" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "provider" TEXT,
    "hours" DECIMAL(5,2),
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "TrainingCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRecord" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "status" "TrainingRecordStatus" NOT NULL DEFAULT 'ENROLLED',
    "enrolledAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "score" DECIMAL(5,2),
    "expiresAt" DATE,
    "certificateId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerformanceCycle_tenantId_idx" ON "PerformanceCycle"("tenantId");

-- CreateIndex
CREATE INDEX "PerformanceCycle_tenantId_status_idx" ON "PerformanceCycle"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PerformanceReview_tenantId_idx" ON "PerformanceReview"("tenantId");

-- CreateIndex
CREATE INDEX "PerformanceReview_tenantId_cycleId_idx" ON "PerformanceReview"("tenantId", "cycleId");

-- CreateIndex
CREATE INDEX "PerformanceReview_tenantId_employeeId_idx" ON "PerformanceReview"("tenantId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceReview_tenantId_cycleId_employeeId_key" ON "PerformanceReview"("tenantId", "cycleId", "employeeId");

-- CreateIndex
CREATE INDEX "PerformanceGoal_tenantId_idx" ON "PerformanceGoal"("tenantId");

-- CreateIndex
CREATE INDEX "PerformanceGoal_tenantId_reviewId_idx" ON "PerformanceGoal"("tenantId", "reviewId");

-- CreateIndex
CREATE INDEX "PerformanceGoal_tenantId_employeeId_idx" ON "PerformanceGoal"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "TrainingCourse_tenantId_idx" ON "TrainingCourse"("tenantId");

-- CreateIndex
CREATE INDEX "TrainingCourse_tenantId_isActive_idx" ON "TrainingCourse"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "TrainingRecord_tenantId_idx" ON "TrainingRecord"("tenantId");

-- CreateIndex
CREATE INDEX "TrainingRecord_tenantId_employeeId_idx" ON "TrainingRecord"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "TrainingRecord_tenantId_status_idx" ON "TrainingRecord"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TrainingRecord_tenantId_expiresAt_idx" ON "TrainingRecord"("tenantId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRecord_tenantId_courseId_employeeId_key" ON "TrainingRecord"("tenantId", "courseId", "employeeId");

-- AddForeignKey
ALTER TABLE "PerformanceCycle" ADD CONSTRAINT "PerformanceCycle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PerformanceCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceGoal" ADD CONSTRAINT "PerformanceGoal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceGoal" ADD CONSTRAINT "PerformanceGoal_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "PerformanceReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceGoal" ADD CONSTRAINT "PerformanceGoal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCourse" ADD CONSTRAINT "TrainingCourse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "EmployeeDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- Tenant isolation (RLS) + runtime grants for the new tables.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['PerformanceCycle', 'PerformanceReview', 'PerformanceGoal', 'TrainingCourse', 'TrainingRecord'];
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
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      "PerformanceCycle", "PerformanceReview", "PerformanceGoal", "TrainingCourse", "TrainingRecord" TO munaxa_app;
  END IF;
END $$;

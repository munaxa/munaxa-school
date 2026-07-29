-- CreateEnum
CREATE TYPE "BehaviorType" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL');

-- CreateTable
CREATE TABLE "Homework" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATE NOT NULL,
    "assignedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkAttachment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "homeworkId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviorLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "type" "BehaviorType" NOT NULL,
    "category" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "date" DATE NOT NULL,
    "recordedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BehaviorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeRecord" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "sectionId" UUID,
    "semesterId" UUID,
    "subject" TEXT NOT NULL,
    "assessment" TEXT NOT NULL,
    "score" DECIMAL(6,2) NOT NULL,
    "maxScore" DECIMAL(6,2) NOT NULL,
    "weight" DECIMAL(5,2),
    "gradedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "GradeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Homework_tenantId_sectionId_idx" ON "Homework"("tenantId", "sectionId");

-- CreateIndex
CREATE INDEX "Homework_tenantId_dueDate_idx" ON "Homework"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "HomeworkAttachment_tenantId_homeworkId_idx" ON "HomeworkAttachment"("tenantId", "homeworkId");

-- CreateIndex
CREATE INDEX "BehaviorLog_tenantId_studentId_date_idx" ON "BehaviorLog"("tenantId", "studentId", "date");

-- CreateIndex
CREATE INDEX "GradeRecord_tenantId_studentId_idx" ON "GradeRecord"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "GradeRecord_tenantId_sectionId_idx" ON "GradeRecord"("tenantId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeRecord_tenantId_studentId_subject_assessment_semesterI_key" ON "GradeRecord"("tenantId", "studentId", "subject", "assessment", "semesterId");

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAttachment" ADD CONSTRAINT "HomeworkAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAttachment" ADD CONSTRAINT "HomeworkAttachment_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorLog" ADD CONSTRAINT "BehaviorLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorLog" ADD CONSTRAINT "BehaviorLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ============================================================================
-- Tenant isolation (RLS) for Academics tables.
-- ============================================================================
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['Homework', 'HomeworkAttachment', 'BehaviorLog', 'GradeRecord'];
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

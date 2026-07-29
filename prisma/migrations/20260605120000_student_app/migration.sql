-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('LINK', 'FILE', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "AchievementCategory" AS ENUM ('ATTENDANCE_STREAK', 'ATTENDANCE_TOTAL', 'ACADEMIC', 'GENERAL');

-- CreateTable
CREATE TABLE "Resource" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "sectionId" UUID,
    "gradeId" UUID,
    "subject" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ResourceType" NOT NULL DEFAULT 'LINK',
    "url" TEXT,
    "fileKey" TEXT,
    "fileName" TEXT,
    "contentType" TEXT,
    "size" INTEGER,
    "uploadedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "category" "AchievementCategory" NOT NULL DEFAULT 'GENERAL',
    "points" INTEGER NOT NULL DEFAULT 0,
    "threshold" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAchievement" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "achievementId" UUID NOT NULL,
    "awardedById" UUID,
    "note" TEXT,
    "earnedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGamification" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StudentGamification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Resource_tenantId_idx" ON "Resource"("tenantId");

-- CreateIndex
CREATE INDEX "Resource_tenantId_sectionId_idx" ON "Resource"("tenantId", "sectionId");

-- CreateIndex
CREATE INDEX "Resource_tenantId_gradeId_idx" ON "Resource"("tenantId", "gradeId");

-- CreateIndex
CREATE INDEX "Achievement_tenantId_idx" ON "Achievement"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_tenantId_key_key" ON "Achievement"("tenantId", "key");

-- CreateIndex
CREATE INDEX "StudentAchievement_tenantId_idx" ON "StudentAchievement"("tenantId");

-- CreateIndex
CREATE INDEX "StudentAchievement_tenantId_studentId_idx" ON "StudentAchievement"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAchievement_studentId_achievementId_key" ON "StudentAchievement"("studentId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGamification_studentId_key" ON "StudentGamification"("studentId");

-- CreateIndex
CREATE INDEX "StudentGamification_tenantId_idx" ON "StudentGamification"("tenantId");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGamification" ADD CONSTRAINT "StudentGamification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGamification" ADD CONSTRAINT "StudentGamification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ============================================================================
-- Tenant isolation (RLS) for Student App tables.
-- ============================================================================
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['Resource', 'Achievement', 'StudentAchievement', 'StudentGamification'];
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

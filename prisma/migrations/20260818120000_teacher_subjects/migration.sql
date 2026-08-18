-- ============================================================================
-- Munaxa — what a teacher teaches
--
-- A teacher is created in HR (an Employee marked as teaching staff), and the
-- subjects they instruct are chosen from the school's Subject catalogue at that
-- moment. TeacherSubject records that choice.
--
-- Deliberately separate from TeacherSection: that table says *where* a teacher
-- teaches (which classroom, optionally under a free-text subject name), while
-- this one says *what* they are qualified to teach, referencing the catalogue
-- the timetable itself picks from.
-- ============================================================================

-- CreateTable
CREATE TABLE "TeacherSubject" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherSubject_teacherId_subjectId_key" ON "TeacherSubject"("teacherId", "subjectId");
CREATE INDEX "TeacherSubject_tenantId_idx" ON "TeacherSubject"("tenantId");
CREATE INDEX "TeacherSubject_teacherId_idx" ON "TeacherSubject"("teacherId");
CREATE INDEX "TeacherSubject_subjectId_idx" ON "TeacherSubject"("subjectId");

-- AddForeignKey
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation (RLS) + runtime grants for the new table.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['TeacherSubject'];
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
    GRANT SELECT, INSERT, UPDATE, DELETE ON "TeacherSubject" TO munaxa_app;
  END IF;
END $$;

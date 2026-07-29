-- ============================================================================
-- Enterprise scheduling engine — clean replacement of the flat timetable.
--
--   AcademicYear → Semester → SchedulePlan → SectionTimetable → ScheduledClass
--
-- The previous timetable data was development/test only, so this is a hard cut-over with NO
-- compatibility layer: the legacy TimetableSlot table is dropped, ScheduleException is modernised to
-- reference Subject + SpecialLocation (instead of free-text + Classroom), and StudentAttendance's
-- `periodIndex` is renamed to `classNumber` ("Class", not "Period", everywhere).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
CREATE TYPE "SchedulePlanStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "SpecialLocationKind" AS ENUM (
  'SCIENCE_LAB', 'COMPUTER_LAB', 'ART_ROOM', 'MUSIC_ROOM', 'SPORTS_HALL', 'LIBRARY', 'AUDITORIUM', 'OTHER'
);

-- ---------------------------------------------------------------------------
-- 2. New tables
-- ---------------------------------------------------------------------------
CREATE TABLE "Subject" (
    "id"        UUID NOT NULL,
    "tenantId"  UUID NOT NULL,
    "nameEn"    TEXT NOT NULL,
    "nameAr"    TEXT NOT NULL,
    "code"      TEXT,
    "colorHex"  TEXT NOT NULL DEFAULT '#64748b',
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpecialLocation" (
    "id"        UUID NOT NULL,
    "tenantId"  UUID NOT NULL,
    "campusId"  UUID NOT NULL,
    "nameEn"    TEXT NOT NULL,
    "nameAr"    TEXT NOT NULL,
    "kind"      "SpecialLocationKind" NOT NULL DEFAULT 'OTHER',
    "capacity"  INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    CONSTRAINT "SpecialLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BellSchedule" (
    "id"           UUID NOT NULL,
    "tenantId"     UUID NOT NULL,
    "campusId"     UUID NOT NULL,
    "name"         TEXT NOT NULL,
    "scheduleType" "ScheduleType" NOT NULL DEFAULT 'REGULAR',
    "createdAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMPTZ(6) NOT NULL,
    "deletedAt"    TIMESTAMPTZ(6),
    CONSTRAINT "BellSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BellSchedulePeriod" (
    "id"             UUID NOT NULL,
    "tenantId"       UUID NOT NULL,
    "bellScheduleId" UUID NOT NULL,
    "classNumber"    INTEGER NOT NULL,
    "startTime"      TEXT NOT NULL,
    "endTime"        TEXT NOT NULL,
    "isBreak"        BOOLEAN NOT NULL DEFAULT false,
    "labelEn"        TEXT,
    "labelAr"        TEXT,
    "createdAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "BellSchedulePeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchedulePlan" (
    "id"             UUID NOT NULL,
    "tenantId"       UUID NOT NULL,
    "semesterId"     UUID NOT NULL,
    "academicYearId" UUID NOT NULL,
    "campusId"       UUID NOT NULL,
    "name"           TEXT NOT NULL,
    "status"         "SchedulePlanStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt"    TIMESTAMPTZ(6),
    "publishedById"  UUID,
    "archivedAt"     TIMESTAMPTZ(6),
    "createdById"    UUID,
    "createdAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMPTZ(6) NOT NULL,
    "deletedAt"      TIMESTAMPTZ(6),
    CONSTRAINT "SchedulePlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SectionTimetable" (
    "id"        UUID NOT NULL,
    "tenantId"  UUID NOT NULL,
    "planId"    UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    CONSTRAINT "SectionTimetable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduledClass" (
    "id"                 UUID NOT NULL,
    "tenantId"           UUID NOT NULL,
    "sectionTimetableId" UUID NOT NULL,
    "scheduleType"       "ScheduleType" NOT NULL DEFAULT 'REGULAR',
    "dayOfWeek"          "DayOfWeek" NOT NULL,
    "classNumber"        INTEGER NOT NULL,
    "startTime"          TEXT NOT NULL,
    "endTime"            TEXT NOT NULL,
    "subjectId"          UUID NOT NULL,
    "teacherId"          UUID,
    "locationId"         UUID,
    "createdAt"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "ScheduledClass_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Subject_tenantId_idx" ON "Subject"("tenantId");
CREATE INDEX "Subject_tenantId_isActive_idx" ON "Subject"("tenantId", "isActive");
CREATE UNIQUE INDEX "Subject_tenantId_code_key" ON "Subject"("tenantId", "code")
  WHERE "code" IS NOT NULL AND "deletedAt" IS NULL;

CREATE INDEX "SpecialLocation_tenantId_campusId_idx" ON "SpecialLocation"("tenantId", "campusId");

CREATE INDEX "BellSchedule_tenantId_campusId_idx" ON "BellSchedule"("tenantId", "campusId");

CREATE UNIQUE INDEX "BellSchedulePeriod_bellScheduleId_classNumber_key" ON "BellSchedulePeriod"("bellScheduleId", "classNumber");
CREATE INDEX "BellSchedulePeriod_tenantId_bellScheduleId_idx" ON "BellSchedulePeriod"("tenantId", "bellScheduleId");

CREATE INDEX "SchedulePlan_tenantId_semesterId_idx" ON "SchedulePlan"("tenantId", "semesterId");
CREATE INDEX "SchedulePlan_tenantId_semesterId_status_idx" ON "SchedulePlan"("tenantId", "semesterId", "status");
-- At most one PUBLISHED plan per semester (ignoring soft-deleted rows).
CREATE UNIQUE INDEX "SchedulePlan_one_published_per_semester" ON "SchedulePlan"("semesterId")
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX "SectionTimetable_planId_sectionId_key" ON "SectionTimetable"("planId", "sectionId");
CREATE INDEX "SectionTimetable_tenantId_planId_idx" ON "SectionTimetable"("tenantId", "planId");
CREATE INDEX "SectionTimetable_tenantId_sectionId_idx" ON "SectionTimetable"("tenantId", "sectionId");

CREATE UNIQUE INDEX "ScheduledClass_key" ON "ScheduledClass"("sectionTimetableId", "scheduleType", "dayOfWeek", "classNumber");
CREATE INDEX "ScheduledClass_tenantId_sectionTimetableId_idx" ON "ScheduledClass"("tenantId", "sectionTimetableId");
CREATE INDEX "ScheduledClass_tenantId_teacherId_idx" ON "ScheduledClass"("tenantId", "teacherId");
CREATE INDEX "ScheduledClass_tenantId_subjectId_idx" ON "ScheduledClass"("tenantId", "subjectId");

-- Foreign keys
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpecialLocation" ADD CONSTRAINT "SpecialLocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpecialLocation" ADD CONSTRAINT "SpecialLocation_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BellSchedule" ADD CONSTRAINT "BellSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BellSchedule" ADD CONSTRAINT "BellSchedule_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BellSchedulePeriod" ADD CONSTRAINT "BellSchedulePeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BellSchedulePeriod" ADD CONSTRAINT "BellSchedulePeriod_bellScheduleId_fkey" FOREIGN KEY ("bellScheduleId") REFERENCES "BellSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SchedulePlan" ADD CONSTRAINT "SchedulePlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchedulePlan" ADD CONSTRAINT "SchedulePlan_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchedulePlan" ADD CONSTRAINT "SchedulePlan_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchedulePlan" ADD CONSTRAINT "SchedulePlan_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SectionTimetable" ADD CONSTRAINT "SectionTimetable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionTimetable" ADD CONSTRAINT "SectionTimetable_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SchedulePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionTimetable" ADD CONSTRAINT "SectionTimetable_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduledClass" ADD CONSTRAINT "ScheduledClass_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledClass" ADD CONSTRAINT "ScheduledClass_sectionTimetableId_fkey" FOREIGN KEY ("sectionTimetableId") REFERENCES "SectionTimetable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledClass" ADD CONSTRAINT "ScheduledClass_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduledClass" ADD CONSTRAINT "ScheduledClass_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduledClass" ADD CONSTRAINT "ScheduledClass_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "SpecialLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. Drop the legacy flat timetable (dev/test data only — no backfill).
-- ---------------------------------------------------------------------------
DROP TABLE "TimetableSlot";

-- ---------------------------------------------------------------------------
-- 4. Modernise ScheduleException: reference Subject + SpecialLocation; rename period → class.
-- ---------------------------------------------------------------------------
ALTER TABLE "ScheduleException" DROP CONSTRAINT IF EXISTS "ScheduleException_classroomId_fkey";
ALTER TABLE "ScheduleException" RENAME COLUMN "periodIndex" TO "classNumber";
ALTER TABLE "ScheduleException" DROP COLUMN "subject";
ALTER TABLE "ScheduleException" DROP COLUMN "classroomId";
ALTER TABLE "ScheduleException" ADD COLUMN "subjectId" UUID;
ALTER TABLE "ScheduleException" ADD COLUMN "locationId" UUID;
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "SpecialLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 5. Rename StudentAttendance.periodIndex → classNumber (Class, not Period).
-- ---------------------------------------------------------------------------
ALTER TABLE "StudentAttendance" RENAME COLUMN "periodIndex" TO "classNumber";
ALTER INDEX "StudentAttendance_tenantId_studentId_date_periodIndex_key"
  RENAME TO "StudentAttendance_tenantId_studentId_date_classNumber_key";

-- ---------------------------------------------------------------------------
-- 6. Tenant isolation (RLS) for the new tables — same pattern as the timetable migration.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'Subject', 'SpecialLocation', 'BellSchedule', 'BellSchedulePeriod',
    'SchedulePlan', 'SectionTimetable', 'ScheduledClass'
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

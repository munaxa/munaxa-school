-- Student-Lifecycle refactor — Step 3 (move academic placement off Student → Enrollment).
--
-- Decisions 4 & 13: Student is a permanent identity record; everything that varies between Academic
-- Years lives on Enrollment. This migration ADDS the year-scoped placement columns to Enrollment and
-- backfills them from the enrollment's Academic Year and its Student. It does NOT drop any Student
-- column — Student.sectionId/status/areaId/transportRequested/enrollmentDate remain as deprecated
-- read-through shims (written by EnrollmentLifecycleService) until the Phase-B cleanup. Additive,
-- backward-compatible, reversible; no ledger change, no data loss.

-- AlterTable — year-scoped placement (all nullable/additive).
ALTER TABLE "Enrollment"
  ADD COLUMN "campusId" UUID,
  ADD COLUMN "classroomId" UUID,
  ADD COLUMN "areaId" UUID,
  ADD COLUMN "transportRequested" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "admissionDate" DATE,
  ADD COLUMN "withdrawalDate" DATE,
  ADD COLUMN "graduationDate" DATE,
  ADD COLUMN "reason" TEXT;

-- Backfill campus from the enrollment's Academic Year (the campus the student attends that year).
UPDATE "Enrollment" AS e
  SET "campusId" = ay."campusId"
  FROM "AcademicYear" AS ay
  WHERE ay."id" = e."academicYearId";

-- Backfill transport intent + home area + admission date from the Student's current (shim) values.
-- admissionDate falls back to the enrollment's own creation date when the student has no enrollmentDate.
UPDATE "Enrollment" AS e
  SET
    "areaId" = s."areaId",
    "transportRequested" = COALESCE(s."transportRequested", false),
    "admissionDate" = COALESCE(s."enrollmentDate"::date, e."createdAt"::date)
  FROM "Student" AS s
  WHERE s."id" = e."studentId";

-- Indexes
CREATE INDEX "Enrollment_tenantId_sectionId_idx" ON "Enrollment"("tenantId", "sectionId");
CREATE INDEX "Enrollment_tenantId_campusId_idx" ON "Enrollment"("tenantId", "campusId");

-- AddForeignKey (all SetNull — placement references are optional and must survive a section/room move)
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_campusId_fkey"
  FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classroomId_fkey"
  FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

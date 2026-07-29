-- Simplify the Academic Year architecture.
--
-- ADDITIVE (registration window) + REMOVAL (obsolete free-text calendar):
--   * Adds optional `registrationStartDate` / `registrationEndDate` to AcademicYear — the
--     admission/registration window for the year. Nullable, so no existing row is affected.
--   * Drops `OrganizationSettings.academicCalendar` — an unvalidatable, unqueryable placeholder
--     string. Readiness now derives the academic calendar from real Semester records instead.
--
-- Instructional boundaries remain the sole responsibility of Semester (name/sequence/start/end);
-- no term-count or holiday/event data is introduced (deferred until schools require it).
--
-- Reverse by:
--   ALTER TABLE "OrganizationSettings" ADD COLUMN "academicCalendar" TEXT;
--   ALTER TABLE "AcademicYear" DROP COLUMN "registrationStartDate", DROP COLUMN "registrationEndDate";

-- AlterTable (additive; both nullable)
ALTER TABLE "AcademicYear"
  ADD COLUMN "registrationStartDate" DATE,
  ADD COLUMN "registrationEndDate" DATE;

-- DropColumn (obsolete placeholder; no source of truth, safe to drop)
ALTER TABLE "OrganizationSettings" DROP COLUMN "academicCalendar";

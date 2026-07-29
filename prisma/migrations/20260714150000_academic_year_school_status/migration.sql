-- Student-Lifecycle refactor — Step 1 (Academic Year → School-scoped + status machine).
--
-- ADDITIVE + BACKWARD-COMPATIBLE + REVERSIBLE (Rev. 3 migration principles):
--   * Adds `AcademicYearStatus` and two columns (`status`, `schoolId`).
--   * `campusId` and `isCurrent` are RETAINED as transition shims (dropped later in Phase B,
--     only after scripts/validate-academic-year-migration.ts confirms no (schoolId,name) or
--     single-active conflicts per Rev. 3 Decision 1 — no silent merge).
--   * No unique-constraint change here, so no existing row can conflict; zero data loss.
--   * Reverse by: DROP COLUMN "schoolId"; DROP COLUMN "status"; DROP TYPE "AcademicYearStatus".
-- RLS is unchanged: AcademicYear already carries the tenant_isolation policy.

-- CreateEnum
CREATE TYPE "AcademicYearStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'CLOSED');

-- AlterTable (additive; status defaults UPCOMING, schoolId nullable during transition)
ALTER TABLE "AcademicYear"
  ADD COLUMN "status" "AcademicYearStatus" NOT NULL DEFAULT 'UPCOMING',
  ADD COLUMN "schoolId" UUID;

-- Backfill schoolId from the owning campus (an Academic Year belongs to the School; the campus
-- merely participates). Every existing row is campus-scoped, so this populates schoolId for all.
UPDATE "AcademicYear" AS ay
  SET "schoolId" = c."schoolId"
  FROM "Campus" AS c
  WHERE c."id" = ay."campusId";

-- Backfill status from the legacy flags:
--   * the flagged current year → ACTIVE (isCurrent == status ACTIVE);
--   * any past, non-current year → CLOSED;
--   * everything else stays UPCOMING (the column default).
UPDATE "AcademicYear" SET "status" = 'ACTIVE' WHERE "isCurrent" = true;
UPDATE "AcademicYear"
  SET "status" = 'CLOSED'
  WHERE "isCurrent" = false AND "endDate" < CURRENT_DATE;

-- Indexes
CREATE INDEX "AcademicYear_tenantId_schoolId_idx" ON "AcademicYear"("tenantId", "schoolId");
CREATE INDEX "AcademicYear_tenantId_status_idx" ON "AcademicYear"("tenantId", "status");

-- AddForeignKey (nullable; onDelete Cascade mirrors Campus→School, but schools use soft-delete)
ALTER TABLE "AcademicYear"
  ADD CONSTRAINT "AcademicYear_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

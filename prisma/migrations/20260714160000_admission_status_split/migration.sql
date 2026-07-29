-- Student-Lifecycle refactor — Step 2 (split admission workflow from participation lifecycle).
--
-- Decision 2: `AdmissionStatus` (workflow) and `EnrollmentStatus` (participation) are distinct
-- concepts and must be distinguishable in reporting and logic. Today `Enrollment.status` conflates
-- them; this migration separates them ADDITIVELY + REVERSIBLY (Rev. 3 migration principles):
--   * NEW enum `AdmissionStatus` + `Enrollment.admissionStatus` carries the workflow.
--   * `EnrollmentStatus` gains the participation states; the legacy admission values remain for the
--     transition (dropped in the Phase-B cleanup, which recreates the type).
--   * Existing rows are remapped: COMMITTED→(REGISTERED, ACTIVE); PENDING_APPROVAL→(ACCEPTED, ACTIVE);
--     CANCELLED→(CANCELLED, status left CANCELLED); QUOTED→(QUOTED, status left).
--   * No ledger change, no data loss. Reverse by dropping the column, the index and the new type,
--     and restoring `status` from `admissionStatus`.

-- CreateEnum (new type — its values may be used immediately below)
CREATE TYPE "AdmissionStatus" AS ENUM ('DRAFT', 'QUOTED', 'ACCEPTED', 'REGISTERED', 'CANCELLED');

-- AlterEnum — participation states added to EnrollmentStatus (idempotent; not USED in this migration,
-- so safe alongside the DDL/DML below).
ALTER TYPE "EnrollmentStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "EnrollmentStatus" ADD VALUE IF NOT EXISTS 'PROMOTED';
ALTER TYPE "EnrollmentStatus" ADD VALUE IF NOT EXISTS 'REPEATED';
ALTER TYPE "EnrollmentStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';
ALTER TYPE "EnrollmentStatus" ADD VALUE IF NOT EXISTS 'GRADUATED';
ALTER TYPE "EnrollmentStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- AlterTable — add the workflow column (all existing rows start REGISTERED, corrected below).
ALTER TABLE "Enrollment"
  ADD COLUMN "admissionStatus" "AdmissionStatus" NOT NULL DEFAULT 'REGISTERED';

-- Backfill admissionStatus from the legacy conflated status (read BEFORE status is remapped).
UPDATE "Enrollment" SET "admissionStatus" = 'ACCEPTED'  WHERE "status" = 'PENDING_APPROVAL';
UPDATE "Enrollment" SET "admissionStatus" = 'CANCELLED' WHERE "status" = 'CANCELLED';
UPDATE "Enrollment" SET "admissionStatus" = 'QUOTED'    WHERE "status" = 'QUOTED';
-- COMMITTED (and any legacy ACTIVE) stay REGISTERED (the column default).

-- Remap participation status: committed/held rows are participating (ACTIVE). CANCELLED stays as the
-- legacy participation-void marker (admissionStatus=CANCELLED is authoritative).
UPDATE "Enrollment" SET "status" = 'ACTIVE' WHERE "status" IN ('COMMITTED', 'PENDING_APPROVAL');

-- New participation default for future rows.
ALTER TABLE "Enrollment" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- Index for admission-funnel reporting.
CREATE INDEX "Enrollment_tenantId_admissionStatus_idx"
  ON "Enrollment"("tenantId", "admissionStatus");

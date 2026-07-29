-- Registration Agreement refinement: lifecycle statuses + signed-copy support (all additive).
--
-- Removes agreement *versioning* behaviorally (one immutable agreement per enrollment) and adds
-- support for uploading the parent's countersigned copy, referenced by an object-storage key (never
-- stored inline). No data is dropped or backfilled — `version`/`supersedesId` remain for backward
-- compatibility. ALTER TYPE ... ADD VALUE runs first and is never used in this migration, so it is
-- safe alongside the ALTER TABLE below.

-- New lifecycle statuses (idempotent). DRAFT/COMMITTED are kept for existing rows.
ALTER TYPE "RegistrationAgreementStatus" ADD VALUE IF NOT EXISTS 'GENERATED';
ALTER TYPE "RegistrationAgreementStatus" ADD VALUE IF NOT EXISTS 'PRINTED';

-- Signed-copy reference (into object storage) + who/when it was signed and uploaded.
ALTER TABLE "RegistrationAgreement"
  ADD COLUMN "signedFileKey"      TEXT,
  ADD COLUMN "signedFileName"     TEXT,
  ADD COLUMN "signedFileType"     TEXT,
  ADD COLUMN "signedFileSize"     INTEGER,
  ADD COLUMN "signedAt"           DATE,
  ADD COLUMN "signedBy"           TEXT,
  ADD COLUMN "signedUploadedById" UUID,
  ADD COLUMN "signedUploadedAt"   TIMESTAMPTZ(6);

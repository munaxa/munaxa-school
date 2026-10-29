-- ============================================================================
-- Licensing state: the revocation list in force (docs/ops/licensing.md, platform ADR-0022).
--
-- A school's own server receives a signed revocation list (`mxr1`) next to its
-- licence. The newest one it verified is kept here, so deleting the file, or
-- offering an older list, does not undo a revocation — across restarts too.
-- `revocationSequence` only grows: the writer updates only when the new one is
-- higher. Both are set together or not at all. Additive: no row changes.
-- ============================================================================
ALTER TABLE "LicensingState"
  ADD COLUMN "revocationList"     TEXT,
  ADD COLUMN "revocationSequence" INTEGER,
  ADD CONSTRAINT "LicensingState_revocation_pair_check"
    CHECK (("revocationList" IS NULL) = ("revocationSequence" IS NULL)),
  ADD CONSTRAINT "LicensingState_revocation_sequence_check"
    CHECK ("revocationSequence" IS NULL OR "revocationSequence" >= 1);

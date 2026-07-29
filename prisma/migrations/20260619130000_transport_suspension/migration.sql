-- Transport suspension state on the student billing profile (Phase 3).
-- Additive columns; default false so existing rows keep transport enabled.
ALTER TABLE "StudentBillingProfile"
  ADD COLUMN "transportSuspended" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "transportSuspendedAt" TIMESTAMPTZ(6);

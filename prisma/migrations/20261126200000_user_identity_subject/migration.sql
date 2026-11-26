-- ============================================================================
-- Sign in with Munaxa Identity (apps/api/src/auth/identity-sign-in).
--
-- Identity's subject, remembered on a user's first sign-in through Identity, so
-- that a later Identity account with the same email cannot sign in as this user.
-- One per tenant. Additive and nullable: no row changes.
-- ============================================================================
ALTER TABLE "User" ADD COLUMN "identitySubject" TEXT;

CREATE UNIQUE INDEX "User_tenantId_identitySubject_key" ON "User"("tenantId", "identitySubject");

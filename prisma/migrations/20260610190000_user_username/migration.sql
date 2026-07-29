-- Add an optional per-tenant login handle (username) for accounts without email
-- (e.g. students/parents). NULLs are allowed and treated as distinct, so many users
-- may have no username. Backward compatible: existing email login is unchanged.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "User_tenantId_username_key" ON "User"("tenantId", "username");

-- Make the parent uniqueness soft-delete aware: a deleted parent must NOT reserve their
-- mobile / national-id, so the same person can be registered again. Replace the plain unique
-- indexes with PARTIAL unique indexes scoped to live (non-deleted) rows.
DROP INDEX IF EXISTS "Parent_tenantId_phone_key";
CREATE UNIQUE INDEX "Parent_tenantId_phone_key"
  ON "Parent" ("tenantId", "phone") WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS "Parent_tenantId_nationalId_key";
CREATE UNIQUE INDEX "Parent_tenantId_nationalId_key"
  ON "Parent" ("tenantId", "nationalId") WHERE "deletedAt" IS NULL;

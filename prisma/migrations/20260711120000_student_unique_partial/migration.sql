-- Make student uniqueness soft-delete aware: a deleted student must NOT reserve their national-id
-- or MoE student number, so the same identifier can be registered again after deletion. Replace the
-- plain unique indexes with PARTIAL unique indexes scoped to live (non-deleted) rows — mirroring the
-- earlier Parent fix (20260622160000_parent_unique_partial).
DROP INDEX IF EXISTS "Student_tenantId_nationalId_key";
CREATE UNIQUE INDEX "Student_tenantId_nationalId_key"
  ON "Student" ("tenantId", "nationalId") WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS "Student_tenantId_moeStudentNumber_key";
CREATE UNIQUE INDEX "Student_tenantId_moeStudentNumber_key"
  ON "Student" ("tenantId", "moeStudentNumber") WHERE "deletedAt" IS NULL;

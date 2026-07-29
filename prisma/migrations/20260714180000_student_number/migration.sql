-- Student-Lifecycle refactor — Step 4 (internal Student Number, Decision 6).
--
-- Adds a school-generated, permanent Student Number (separate from National ID / MoE number),
-- allocated from a per-tenant gapless counter (same pattern as PaymentReceiptCounter/EInvoiceCounter)
-- that is configurable per school: optional prefix, padding length, starting value, reset policy
-- (NEVER by default). Additive, backward-compatible, reversible; no ledger change, no data loss.
-- Reverse by: DROP COLUMN "studentNumber"; DROP TABLE "StudentNumberCounter"; DROP TYPE.

-- CreateEnum
CREATE TYPE "StudentNumberResetPolicy" AS ENUM ('NEVER', 'ANNUAL');

-- CreateTable
CREATE TABLE "StudentNumberCounter" (
  "id"          UUID NOT NULL,
  "tenantId"    UUID NOT NULL,
  "prefix"      TEXT,
  "padLength"   INTEGER NOT NULL DEFAULT 6,
  "nextNumber"  INTEGER NOT NULL DEFAULT 1,
  "resetPolicy" "StudentNumberResetPolicy" NOT NULL DEFAULT 'NEVER',
  "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "StudentNumberCounter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentNumberCounter_tenantId_key" ON "StudentNumberCounter"("tenantId");
ALTER TABLE "StudentNumberCounter" ADD CONSTRAINT "StudentNumberCounter_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable — additive, nullable.
ALTER TABLE "Student" ADD COLUMN "studentNumber" TEXT;

-- Backfill: one counter per tenant, its nextNumber set past the highest assigned number; then assign a
-- gapless, zero-padded number to every existing student ordered by creation. Prefix is null initially
-- (schools may set a prefix later without affecting already-assigned numbers).
INSERT INTO "StudentNumberCounter" ("id", "tenantId", "padLength", "nextNumber", "resetPolicy", "updatedAt")
  SELECT gen_random_uuid(), s."tenantId", 6, COUNT(*) + 1, 'NEVER', CURRENT_TIMESTAMP
  FROM "Student" s
  GROUP BY s."tenantId"
  ON CONFLICT ("tenantId") DO NOTHING;

WITH numbered AS (
  SELECT
    "id",
    LPAD(
      ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt", "id")::text,
      6, '0'
    ) AS num
  FROM "Student"
)
UPDATE "Student" s SET "studentNumber" = n.num
  FROM numbered n
  WHERE n."id" = s."id";

-- Soft-delete-aware uniqueness (mirrors Student national-id / MoE partial unique indexes): a null or a
-- soft-deleted student never reserves a number.
CREATE UNIQUE INDEX "Student_tenantId_studentNumber_key"
  ON "Student" ("tenantId", "studentNumber")
  WHERE "studentNumber" IS NOT NULL AND "deletedAt" IS NULL;

-- Row-Level Security (fail-closed tenant isolation; consistent with the counter tables).
ALTER TABLE "StudentNumberCounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentNumberCounter" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "StudentNumberCounter";
CREATE POLICY tenant_isolation ON "StudentNumberCounter"
  USING ("tenantId" = app_current_tenant() OR app_is_platform())
  WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform());

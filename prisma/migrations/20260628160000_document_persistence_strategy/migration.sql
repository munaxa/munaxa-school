-- ============================================================================
-- Document Engine — Persistence Strategy + Access/Email history (Phase 23b)
--   Optimisation of the existing Document Engine: documents now declare a
--   persistence strategy. SNAPSHOT documents (legal records, e.g. the
--   Registration Agreement) keep storing the rendered PDF immutably. DYNAMIC
--   documents (operational finance reports) store metadata only and are
--   re-rendered on demand from the live billing ledger — no archived PDFs.
--
--   Also replaces the single print counter with a full DocumentAccessLog and a
--   DocumentEmailLog (metadata-only email history).
--
-- Additive & backward compatible:
--   * existing GeneratedDocument rows are legal PDFs → backfilled as SNAPSHOT;
--   * pdf/checksum/byteSize/dataSnapshot become NULLABLE (widening only);
--   * three new enums + two new tenant-scoped tables (RLS).
-- ============================================================================

-- CreateEnum
CREATE TYPE "DocumentPersistence" AS ENUM ('SNAPSHOT', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "DocumentAccessAction" AS ENUM ('GENERATE', 'PRINT', 'DOWNLOAD', 'EMAIL', 'VIEW');

-- CreateEnum
CREATE TYPE "DocumentAccessStatus" AS ENUM ('SUCCESS', 'FAILED');

-- ----------------------------------------------------------------------------
-- GeneratedDocument: persistence strategy, nullable artifact columns, params,
-- and the richer access counters.
-- ----------------------------------------------------------------------------
ALTER TABLE "GeneratedDocument"
  ADD COLUMN "persistence"        "DocumentPersistence" NOT NULL DEFAULT 'SNAPSHOT',
  ADD COLUMN "params"             JSONB,
  ADD COLUMN "downloadCount"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "emailCount"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastDownloadedAt"   TIMESTAMPTZ(6),
  ADD COLUMN "lastEmailedAt"      TIMESTAMPTZ(6),
  ADD COLUMN "lastPrintedById"    UUID,
  ADD COLUMN "lastDownloadedById" UUID,
  ADD COLUMN "lastEmailedById"    UUID;

-- Widen artifact columns to NULL (DYNAMIC documents store no PDF/snapshot).
ALTER TABLE "GeneratedDocument" ALTER COLUMN "dataSnapshot" DROP NOT NULL;
ALTER TABLE "GeneratedDocument" ALTER COLUMN "pdf" DROP NOT NULL;
ALTER TABLE "GeneratedDocument" ALTER COLUMN "checksum" DROP NOT NULL;
ALTER TABLE "GeneratedDocument" ALTER COLUMN "byteSize" DROP NOT NULL;

-- ----------------------------------------------------------------------------
-- DocumentAccessLog: complete per-action history.
-- ----------------------------------------------------------------------------
CREATE TABLE "DocumentAccessLog" (
    "id"           UUID                   NOT NULL,
    "tenantId"     UUID                   NOT NULL,
    "documentId"   UUID                   NOT NULL,
    "documentType" "DocumentType"         NOT NULL,
    "action"       "DocumentAccessAction" NOT NULL,
    "status"       "DocumentAccessStatus" NOT NULL DEFAULT 'SUCCESS',
    "actorUserId"  UUID,
    "ip"           TEXT,
    "userAgent"    TEXT,
    "device"       TEXT,
    "detail"       TEXT,
    "createdAt"    TIMESTAMPTZ(6)         NOT NULL DEFAULT now(),

    CONSTRAINT "DocumentAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentAccessLog_tenantId_documentId_createdAt_idx"
  ON "DocumentAccessLog"("tenantId", "documentId", "createdAt");
CREATE INDEX "DocumentAccessLog_tenantId_action_idx"
  ON "DocumentAccessLog"("tenantId", "action");

ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "GeneratedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- DocumentEmailLog: metadata-only email-delivery history.
-- ----------------------------------------------------------------------------
CREATE TABLE "DocumentEmailLog" (
    "id"               UUID                   NOT NULL,
    "tenantId"         UUID                   NOT NULL,
    "documentId"       UUID                   NOT NULL,
    "sentById"         UUID,
    "recipients"       TEXT[]                 NOT NULL DEFAULT ARRAY[]::TEXT[],
    "cc"               TEXT[]                 NOT NULL DEFAULT ARRAY[]::TEXT[],
    "bcc"              TEXT[]                 NOT NULL DEFAULT ARRAY[]::TEXT[],
    "subject"          TEXT,
    "providerResponse" TEXT,
    "status"           "DocumentAccessStatus" NOT NULL DEFAULT 'SUCCESS',
    "retryCount"       INTEGER                NOT NULL DEFAULT 0,
    "sentAt"           TIMESTAMPTZ(6)         NOT NULL DEFAULT now(),

    CONSTRAINT "DocumentEmailLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentEmailLog_tenantId_documentId_sentAt_idx"
  ON "DocumentEmailLog"("tenantId", "documentId", "sentAt");

ALTER TABLE "DocumentEmailLog" ADD CONSTRAINT "DocumentEmailLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentEmailLog" ADD CONSTRAINT "DocumentEmailLog_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "GeneratedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- Tenant isolation (RLS) for the two new tables.
-- ----------------------------------------------------------------------------
ALTER TABLE "DocumentAccessLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentAccessLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "DocumentAccessLog";
CREATE POLICY tenant_isolation ON "DocumentAccessLog"
  USING ("tenantId" = app_current_tenant() OR app_is_platform())
  WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform());

ALTER TABLE "DocumentEmailLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentEmailLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "DocumentEmailLog";
CREATE POLICY tenant_isolation ON "DocumentEmailLog"
  USING ("tenantId" = app_current_tenant() OR app_is_platform())
  WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform());

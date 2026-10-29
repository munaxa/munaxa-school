-- ============================================================================
-- Stored objects: the bytes each school holds in the bucket (docs/ops/licensing.md,
-- "Storage").
--
-- One row per object key. The `storage_gb` plan limit is enforced against this
-- ledger, never against a size the client declares:
--   RESERVED  an upload URL was issued; `reservedBytes` (the declared size, or the
--             per-upload ceiling) counts against the limit until `expiresAt`.
--   STORED    the upload was confirmed; `storedBytes` is the size the bucket
--             reported for the object.
--   DELETED   the object was removed (or never arrived, or was refused).
-- Additive: no existing table, column or row changes. Objects uploaded before this
-- migration are adopted by the reconciliation job (`storage:reconcile`).
-- ============================================================================
CREATE TABLE "StoredObject" (
  "key"           TEXT           NOT NULL,
  "tenantId"      UUID           NOT NULL,
  "state"         TEXT           NOT NULL,
  "reservedBytes" BIGINT         NOT NULL,
  "storedBytes"   BIGINT,
  "expiresAt"     TIMESTAMPTZ(6) NOT NULL,
  "createdAt"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "StoredObject_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "StoredObject_state_check" CHECK ("state" IN ('RESERVED', 'STORED', 'DELETED')),
  CONSTRAINT "StoredObject_bytes_check" CHECK ("reservedBytes" >= 0 AND ("storedBytes" IS NULL OR "storedBytes" >= 0)),
  CONSTRAINT "StoredObject_stored_has_size" CHECK ("state" <> 'STORED' OR "storedBytes" IS NOT NULL),
  -- The key is the tenant's own namespace (StorageService.buildKey); a row can never describe
  -- another school's object.
  CONSTRAINT "StoredObject_key_in_tenant" CHECK ("key" LIKE 'tenants/' || "tenantId"::text || '/%')
);

CREATE INDEX "StoredObject_tenantId_state_idx" ON "StoredObject"("tenantId", "state");

ALTER TABLE "StoredObject"
  ADD CONSTRAINT "StoredObject_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE "StoredObject" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "StoredObject" FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON "StoredObject"';
  EXECUTE $f$
    CREATE POLICY tenant_isolation ON "StoredObject"
      USING ("tenantId" = app_current_tenant() OR app_is_platform())
      WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform())
  $f$;
END $$;

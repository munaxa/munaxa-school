-- ============================================================================
-- Licensing state: what this deployment last verified about a school's
-- entitlements (docs/ops/licensing.md).
--
-- One row per school, written by the API's licensing source only: the last
-- snapshot the central subscription service (or a licence file) gave, and the
-- latest instant the deployment observed. Before this table both lived in the
-- process, so a process started during an outage had nothing to bridge it with
-- and a clock wound back across a restart was judged only against a licence's
-- issue time. `lastObservedAt` only moves forward: the writer keeps
-- GREATEST(stored, given). A NULL snapshot is an answer ("no subscription"),
-- and nothing may bridge a later outage into access it has withdrawn.
-- Additive: no existing table, column or row changes.
-- ============================================================================
CREATE TABLE "LicensingState" (
  "tenantId"       UUID         NOT NULL,
  "snapshot"       JSONB,
  "source"         TEXT         NOT NULL,
  "lastObservedAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "LicensingState_pkey" PRIMARY KEY ("tenantId"),
  CONSTRAINT "LicensingState_source_check" CHECK ("source" IN ('LICENSE_FILE', 'CONTROL_PLANE'))
);

ALTER TABLE "LicensingState"
  ADD CONSTRAINT "LicensingState_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE "LicensingState" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "LicensingState" FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON "LicensingState"';
  EXECUTE $f$
    CREATE POLICY tenant_isolation ON "LicensingState"
      USING ("tenantId" = app_current_tenant() OR app_is_platform())
      WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform())
  $f$;
END $$;

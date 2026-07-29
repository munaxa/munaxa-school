-- CreateEnum
CREATE TYPE "TenantDbStatus" AS ENUM ('REQUESTED', 'PROVISIONED', 'MIGRATED', 'DATA_COPIED', 'VERIFIED', 'ACTIVE', 'FAILED', 'ABORTED');

-- CreateTable
CREATE TABLE "TenantDatabase" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "status" "TenantDbStatus" NOT NULL DEFAULT 'REQUESTED',
    "connectionRef" TEXT,
    "hostLabel" TEXT,
    "note" TEXT,
    "lastError" TEXT,
    "requestedById" UUID,
    "activatedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "TenantDatabase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantDatabase_tenantId_key" ON "TenantDatabase"("tenantId");

-- CreateIndex
CREATE INDEX "TenantDatabase_status_idx" ON "TenantDatabase"("status");

-- AddForeignKey
ALTER TABLE "TenantDatabase" ADD CONSTRAINT "TenantDatabase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ============================================================================
-- Tenant isolation (RLS) for the control-plane registry. Platform plane reads all;
-- a tenant context sees only its own row.
-- ============================================================================
DO $$
BEGIN
  EXECUTE 'ALTER TABLE "TenantDatabase" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "TenantDatabase" FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON "TenantDatabase"';
  EXECUTE $f$
    CREATE POLICY tenant_isolation ON "TenantDatabase"
      USING ("tenantId" = app_current_tenant() OR app_is_platform())
      WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform())
  $f$;
END $$;

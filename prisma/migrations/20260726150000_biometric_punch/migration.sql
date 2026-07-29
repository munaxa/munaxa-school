-- CreateEnum
CREATE TYPE "BiometricPunchDirection" AS ENUM ('IN', 'OUT');

-- CreateTable
CREATE TABLE "BiometricRawPunch" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID,
    "providerKey" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "deviceId" TEXT,
    "punchAt" TIMESTAMPTZ(6) NOT NULL,
    "direction" "BiometricPunchDirection" NOT NULL,
    "externalUserRef" TEXT,
    "rawPayload" JSONB,
    "processedAt" TIMESTAMPTZ(6),
    "processingError" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiometricRawPunch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BiometricRawPunch_tenantId_providerKey_externalRef_key" ON "BiometricRawPunch"("tenantId", "providerKey", "externalRef");
CREATE INDEX "BiometricRawPunch_tenantId_punchAt_idx" ON "BiometricRawPunch"("tenantId", "punchAt");
CREATE INDEX "BiometricRawPunch_tenantId_employeeId_punchAt_idx" ON "BiometricRawPunch"("tenantId", "employeeId", "punchAt");
CREATE INDEX "BiometricRawPunch_tenantId_processedAt_idx" ON "BiometricRawPunch"("tenantId", "processedAt");

-- AddForeignKey
ALTER TABLE "BiometricRawPunch" ADD CONSTRAINT "BiometricRawPunch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BiometricRawPunch" ADD CONSTRAINT "BiometricRawPunch_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant isolation (RLS) + runtime grants for the new tables.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['BiometricRawPunch'];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING ("tenantId" = app_current_tenant() OR app_is_platform())
        WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform())
    $f$, t);
  END LOOP;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'munaxa_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "BiometricRawPunch" TO munaxa_app;
  END IF;
END $$;

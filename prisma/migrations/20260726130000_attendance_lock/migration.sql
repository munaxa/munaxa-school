-- CreateEnum
CREATE TYPE "AttendanceLockScope" AS ENUM ('DAY', 'WEEK', 'PAYROLL', 'SEMESTER');
CREATE TYPE "AttendanceLockStatus" AS ENUM ('ACTIVE', 'RELEASED');

-- CreateTable
CREATE TABLE "AttendanceLock" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "campusId" UUID,
    "scope" "AttendanceLockScope" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "AttendanceLockStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "lockedById" UUID,
    "lockedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedById" UUID,
    "releasedAt" TIMESTAMPTZ(6),
    "releaseNote" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AttendanceLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceLock_tenantId_idx" ON "AttendanceLock"("tenantId");
CREATE INDEX "AttendanceLock_tenantId_status_periodStart_periodEnd_idx" ON "AttendanceLock"("tenantId", "status", "periodStart", "periodEnd");
CREATE INDEX "AttendanceLock_tenantId_campusId_status_idx" ON "AttendanceLock"("tenantId", "campusId", "status");

-- AddForeignKey
ALTER TABLE "AttendanceLock" ADD CONSTRAINT "AttendanceLock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceLock" ADD CONSTRAINT "AttendanceLock_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceLock" ADD CONSTRAINT "AttendanceLock_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceLock" ADD CONSTRAINT "AttendanceLock_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant isolation (RLS) + runtime grants for the new tables.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['AttendanceLock'];
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
    GRANT SELECT, INSERT, UPDATE, DELETE ON "AttendanceLock" TO munaxa_app;
  END IF;
END $$;

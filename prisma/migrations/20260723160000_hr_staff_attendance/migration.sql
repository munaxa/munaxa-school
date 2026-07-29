-- CreateEnum
CREATE TYPE "StaffAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EARLY_DEPARTURE', 'ON_LEAVE', 'HOLIDAY', 'REMOTE');

-- CreateEnum
CREATE TYPE "StaffAttendanceSource" AS ENUM ('MANUAL', 'QR', 'BIOMETRIC', 'GPS', 'MOBILE');

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" "StaffAttendanceStatus" NOT NULL,
    "source" "StaffAttendanceSource" NOT NULL DEFAULT 'MANUAL',
    "checkInAt" TIMESTAMPTZ(6),
    "checkOutAt" TIMESTAMPTZ(6),
    "lateMinutes" INTEGER,
    "overtimeHours" DECIMAL(5,2),
    "note" TEXT,
    "correctedFromStatus" "StaffAttendanceStatus",
    "correctedById" UUID,
    "correctedAt" TIMESTAMPTZ(6),
    "markedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAttendance_tenantId_idx" ON "StaffAttendance"("tenantId");

-- CreateIndex
CREATE INDEX "StaffAttendance_tenantId_date_idx" ON "StaffAttendance"("tenantId", "date");

-- CreateIndex
CREATE INDEX "StaffAttendance_tenantId_employeeId_idx" ON "StaffAttendance"("tenantId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_tenantId_employeeId_date_key" ON "StaffAttendance"("tenantId", "employeeId", "date");

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Tenant isolation (RLS) + runtime grants for the new table.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['StaffAttendance'];
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
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      "StaffAttendance" TO munaxa_app;
  END IF;
END $$;

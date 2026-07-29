-- CreateEnum
CREATE TYPE "ShiftKind" AS ENUM ('MORNING', 'EVENING', 'SPLIT', 'FLEXIBLE', 'WEEKEND', 'CUSTOM');

-- CreateTable
CREATE TABLE "AttendancePolicy" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "campusId" UUID,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "graceMinutes" INTEGER NOT NULL DEFAULT 5,
    "lateAfterMinutes" INTEGER NOT NULL DEFAULT 1,
    "absentAfterMinutes" INTEGER NOT NULL DEFAULT 240,
    "halfDayAfterShortfallMinutes" INTEGER NOT NULL DEFAULT 180,
    "earlyDepartureAfterMinutes" INTEGER NOT NULL DEFAULT 15,
    "overtimeAfterMinutes" INTEGER NOT NULL DEFAULT 30,
    "countWeekendAsWorking" BOOLEAN NOT NULL DEFAULT false,
    "allowManualOverride" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AttendancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "campusId" UUID,
    "policyId" UUID,
    "name" TEXT NOT NULL,
    "kind" "ShiftKind" NOT NULL DEFAULT 'MORNING',
    "expectedCheckIn" TEXT NOT NULL,
    "expectedCheckOut" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "maxHours" DECIMAL(4,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeShiftAssignment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "daysOfWeek" "DayOfWeek"[],
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "EmployeeShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendancePolicy_tenantId_name_key" ON "AttendancePolicy"("tenantId", "name");
CREATE INDEX "AttendancePolicy_tenantId_idx" ON "AttendancePolicy"("tenantId");
CREATE INDEX "AttendancePolicy_tenantId_campusId_idx" ON "AttendancePolicy"("tenantId", "campusId");
CREATE UNIQUE INDEX "Shift_tenantId_name_key" ON "Shift"("tenantId", "name");
CREATE INDEX "Shift_tenantId_idx" ON "Shift"("tenantId");
CREATE INDEX "Shift_tenantId_campusId_idx" ON "Shift"("tenantId", "campusId");
CREATE INDEX "EmployeeShiftAssignment_tenantId_idx" ON "EmployeeShiftAssignment"("tenantId");
CREATE INDEX "EmployeeShiftAssignment_tenantId_employeeId_effectiveFrom_idx" ON "EmployeeShiftAssignment"("tenantId", "employeeId", "effectiveFrom");
CREATE INDEX "EmployeeShiftAssignment_tenantId_shiftId_idx" ON "EmployeeShiftAssignment"("tenantId", "shiftId");

-- AddForeignKey
ALTER TABLE "AttendancePolicy" ADD CONSTRAINT "AttendancePolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendancePolicy" ADD CONSTRAINT "AttendancePolicy_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AttendancePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeShiftAssignment" ADD CONSTRAINT "EmployeeShiftAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeShiftAssignment" ADD CONSTRAINT "EmployeeShiftAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeShiftAssignment" ADD CONSTRAINT "EmployeeShiftAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeShiftAssignment" ADD CONSTRAINT "EmployeeShiftAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant isolation (RLS) + runtime grants for the new tables.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['AttendancePolicy', 'Shift', 'EmployeeShiftAssignment'];
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
      "AttendancePolicy", "Shift", "EmployeeShiftAssignment" TO munaxa_app;
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "AttendanceCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED', 'CANCELLED');
CREATE TYPE "AttendanceCorrectionDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "AttendanceCorrectionRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "requestedStatus" "StaffAttendanceStatus" NOT NULL,
    "requestedCheckInAt" TIMESTAMPTZ(6),
    "requestedCheckOutAt" TIMESTAMPTZ(6),
    "requestedNote" TEXT,
    "previousStatus" "StaffAttendanceStatus",
    "reason" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "requiredLevels" INTEGER NOT NULL DEFAULT 1,
    "requestedById" UUID,
    "appliedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AttendanceCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCorrectionApproval" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "decision" "AttendanceCorrectionDecision" NOT NULL,
    "note" TEXT,
    "decidedById" UUID,
    "decidedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceCorrectionApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceCorrectionRequest_tenantId_idx" ON "AttendanceCorrectionRequest"("tenantId");
CREATE INDEX "AttendanceCorrectionRequest_tenantId_status_idx" ON "AttendanceCorrectionRequest"("tenantId", "status");
CREATE INDEX "AttendanceCorrectionRequest_tenantId_employeeId_date_idx" ON "AttendanceCorrectionRequest"("tenantId", "employeeId", "date");
CREATE UNIQUE INDEX "AttendanceCorrectionApproval_requestId_level_key" ON "AttendanceCorrectionApproval"("requestId", "level");
CREATE INDEX "AttendanceCorrectionApproval_tenantId_idx" ON "AttendanceCorrectionApproval"("tenantId");

-- AddForeignKey
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionApproval" ADD CONSTRAINT "AttendanceCorrectionApproval_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionApproval" ADD CONSTRAINT "AttendanceCorrectionApproval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AttendanceCorrectionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionApproval" ADD CONSTRAINT "AttendanceCorrectionApproval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant isolation (RLS) + runtime grants for the new tables.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['AttendanceCorrectionRequest', 'AttendanceCorrectionApproval'];
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
      "AttendanceCorrectionRequest", "AttendanceCorrectionApproval" TO munaxa_app;
  END IF;
END $$;

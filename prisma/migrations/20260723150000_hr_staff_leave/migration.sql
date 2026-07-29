-- ============================================================================
-- HR transformation — Phase 4: staff leave management (types, balances, requests,
-- multi-level approvals). Distinct from the student LeaveRequest (parent portal).
-- Purely additive; all tables tenant-scoped with RLS.
-- ============================================================================

-- CreateEnum
CREATE TYPE "StaffLeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "StaffLeaveType" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "defaultAnnualDays" INTEGER,
    "approvalLevels" INTEGER NOT NULL DEFAULT 1,
    "colorHex" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "StaffLeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffLeaveBalance" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "leaveTypeId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "entitledDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "usedDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StaffLeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffLeaveRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "leaveTypeId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "workingDays" DECIMAL(6,2) NOT NULL,
    "reason" TEXT,
    "status" "StaffLeaveStatus" NOT NULL DEFAULT 'PENDING',
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "requiredLevels" INTEGER NOT NULL DEFAULT 1,
    "requestedById" UUID,
    "decidedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StaffLeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffLeaveApproval" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "decision" "LeaveApprovalDecision" NOT NULL,
    "note" TEXT,
    "approverId" UUID,
    "decidedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffLeaveApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffLeaveType_tenantId_idx" ON "StaffLeaveType"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffLeaveType_tenantId_name_key" ON "StaffLeaveType"("tenantId", "name");

-- CreateIndex
CREATE INDEX "StaffLeaveBalance_tenantId_idx" ON "StaffLeaveBalance"("tenantId");

-- CreateIndex
CREATE INDEX "StaffLeaveBalance_tenantId_employeeId_idx" ON "StaffLeaveBalance"("tenantId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffLeaveBalance_employeeId_leaveTypeId_year_key" ON "StaffLeaveBalance"("employeeId", "leaveTypeId", "year");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_tenantId_idx" ON "StaffLeaveRequest"("tenantId");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_tenantId_employeeId_idx" ON "StaffLeaveRequest"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_tenantId_status_idx" ON "StaffLeaveRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "StaffLeaveApproval_tenantId_idx" ON "StaffLeaveApproval"("tenantId");

-- CreateIndex
CREATE INDEX "StaffLeaveApproval_tenantId_requestId_idx" ON "StaffLeaveApproval"("tenantId", "requestId");

-- AddForeignKey
ALTER TABLE "StaffLeaveType" ADD CONSTRAINT "StaffLeaveType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveBalance" ADD CONSTRAINT "StaffLeaveBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveBalance" ADD CONSTRAINT "StaffLeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveBalance" ADD CONSTRAINT "StaffLeaveBalance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "StaffLeaveType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "StaffLeaveType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveApproval" ADD CONSTRAINT "StaffLeaveApproval_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveApproval" ADD CONSTRAINT "StaffLeaveApproval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StaffLeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveApproval" ADD CONSTRAINT "StaffLeaveApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Tenant isolation (RLS) + runtime grants for the new tables.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['StaffLeaveType', 'StaffLeaveBalance', 'StaffLeaveRequest', 'StaffLeaveApproval'];
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
      "StaffLeaveType", "StaffLeaveBalance", "StaffLeaveRequest", "StaffLeaveApproval" TO munaxa_app;
  END IF;
END $$;

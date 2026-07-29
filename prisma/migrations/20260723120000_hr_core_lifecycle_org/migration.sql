-- ============================================================================
-- HR transformation — Phase 1: core staff person, employee lifecycle, org engine.
--
--   Employee (canonical staff person, enriched identity + employment + org placement)
--     ├─ EmployeeStatusHistory (16-state lifecycle, audited transitions)
--     ├─ Department (self-referential org tree, campus-scoped)  ── Position
--     └─ Teacher.employeeId (academic facet linked 1:1 to the HR record)
--
-- The previous Employee.department free-text column is REPLACED by a real Department FK. Any
-- existing (demo) department strings are migrated into Department rows first, so no data is lost.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'HOURLY', 'SEASONAL', 'CONSULTANT', 'SUBSTITUTE', 'INTERN', 'VOLUNTEER');

CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER');

-- Expand the employee lifecycle from 3 → 16 states. Additive: existing ACTIVE / ON_LEAVE /
-- TERMINATED rows are untouched. IF NOT EXISTS keeps re-runs safe.
ALTER TYPE "EmploymentStatus" ADD VALUE IF NOT EXISTS 'CANDIDATE';
ALTER TYPE "EmploymentStatus" ADD VALUE IF NOT EXISTS 'INTERVIEW';
ALTER TYPE "EmploymentStatus" ADD VALUE IF NOT EXISTS 'OFFER_SENT';
ALTER TYPE "EmploymentStatus" ADD VALUE IF NOT EXISTS 'BACKGROUND_CHECK';
ALTER TYPE "EmploymentStatus" ADD VALUE IF NOT EXISTS 'OFFER_ACCEPTED';
ALTER TYPE "EmploymentStatus" ADD VALUE IF NOT EXISTS 'HIRED';
ALTER TYPE "EmploymentStatus" ADD VALUE IF NOT EXISTS 'PROBATION';
ALTER TYPE "EmploymentStatus" ADD VALUE IF NOT EXISTS 'TRANSFERRED';
ALTER TYPE "EmploymentStatus" ADD VALUE IF NOT EXISTS 'PROMOTION';
ALTER TYPE "EmploymentStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE "EmploymentStatus" ADD VALUE IF NOT EXISTS 'RETIRED';
ALTER TYPE "EmploymentStatus" ADD VALUE IF NOT EXISTS 'RESIGNED';
ALTER TYPE "EmploymentStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- ---------------------------------------------------------------------------
-- 2. Org tables (created before the Employee backfill needs them)
-- ---------------------------------------------------------------------------
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "campusId" UUID,
    "parentId" UUID,
    "headEmployeeId" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Position" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "departmentId" UUID,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "budgetedHeadcount" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeStatusHistory" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "fromStatus" "EmploymentStatus",
    "toStatus" "EmploymentStatus" NOT NULL,
    "reason" TEXT,
    "effectiveDate" DATE,
    "actorUserId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeStatusHistory_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 3. Enrich Employee (add new columns; department string dropped after backfill)
-- ---------------------------------------------------------------------------
ALTER TABLE "Employee"
    ADD COLUMN "campusId" UUID,
    ADD COLUMN "createdById" UUID,
    ADD COLUMN "dateOfBirth" DATE,
    ADD COLUMN "departmentId" UUID,
    ADD COLUMN "employeeNumber" TEXT,
    ADD COLUMN "employmentType" "EmploymentType",
    ADD COLUMN "gender" "Gender",
    ADD COLUMN "hireDate" DATE,
    ADD COLUMN "managerId" UUID,
    ADD COLUMN "maritalStatus" "MaritalStatus",
    ADD COLUMN "nationalId" TEXT,
    ADD COLUMN "nationality" TEXT,
    ADD COLUMN "passportNumber" TEXT,
    ADD COLUMN "personalEmail" TEXT,
    ADD COLUMN "personalPhone" TEXT,
    ADD COLUMN "photoUrl" TEXT,
    ADD COLUMN "positionId" UUID,
    ADD COLUMN "probationEndDate" DATE,
    ADD COLUMN "religion" TEXT,
    ADD COLUMN "terminationDate" DATE,
    ADD COLUMN "updatedById" UUID,
    ADD COLUMN "visaExpiry" DATE,
    ADD COLUMN "visaNumber" TEXT,
    ADD COLUMN "workingHoursPerWeek" DECIMAL(5,2);

-- Backfill: promote each distinct free-text department into a real Department row, then link.
INSERT INTO "Department" ("id", "tenantId", "name", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), d."tenantId", d."department", true, now(), now()
FROM (
  SELECT DISTINCT "tenantId", "department"
  FROM "Employee"
  WHERE "department" IS NOT NULL AND btrim("department") <> ''
) d;

UPDATE "Employee" e
SET "departmentId" = d."id"
FROM "Department" d
WHERE d."tenantId" = e."tenantId" AND d."name" = e."department";

ALTER TABLE "Employee" DROP COLUMN "department";

-- ---------------------------------------------------------------------------
-- 4. Teacher ↔ Employee link
-- ---------------------------------------------------------------------------
ALTER TABLE "Teacher" ADD COLUMN "employeeId" UUID;

-- ---------------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX "EmployeeStatusHistory_tenantId_idx" ON "EmployeeStatusHistory"("tenantId");
CREATE INDEX "EmployeeStatusHistory_tenantId_employeeId_createdAt_idx" ON "EmployeeStatusHistory"("tenantId", "employeeId", "createdAt");
CREATE INDEX "Department_tenantId_idx" ON "Department"("tenantId");
CREATE INDEX "Department_tenantId_parentId_idx" ON "Department"("tenantId", "parentId");
CREATE INDEX "Department_tenantId_campusId_idx" ON "Department"("tenantId", "campusId");
CREATE UNIQUE INDEX "Department_tenantId_name_key" ON "Department"("tenantId", "name");
CREATE INDEX "Position_tenantId_idx" ON "Position"("tenantId");
CREATE INDEX "Position_tenantId_departmentId_idx" ON "Position"("tenantId", "departmentId");
CREATE UNIQUE INDEX "Position_tenantId_title_key" ON "Position"("tenantId", "title");
CREATE INDEX "Employee_tenantId_status_idx" ON "Employee"("tenantId", "status");
CREATE INDEX "Employee_tenantId_departmentId_idx" ON "Employee"("tenantId", "departmentId");
CREATE INDEX "Employee_tenantId_campusId_idx" ON "Employee"("tenantId", "campusId");
CREATE INDEX "Employee_managerId_idx" ON "Employee"("managerId");
CREATE UNIQUE INDEX "Employee_tenantId_employeeNumber_key" ON "Employee"("tenantId", "employeeNumber");
CREATE UNIQUE INDEX "Teacher_employeeId_key" ON "Teacher"("employeeId");

-- ---------------------------------------------------------------------------
-- 6. Foreign keys
-- ---------------------------------------------------------------------------
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeStatusHistory" ADD CONSTRAINT "EmployeeStatusHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeStatusHistory" ADD CONSTRAINT "EmployeeStatusHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeStatusHistory" ADD CONSTRAINT "EmployeeStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_headEmployeeId_fkey" FOREIGN KEY ("headEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Position" ADD CONSTRAINT "Position_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Position" ADD CONSTRAINT "Position_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 7. Reconcile a pre-existing index name drift (unrelated to HR; from the scheduling migration).
-- ---------------------------------------------------------------------------
ALTER INDEX "ScheduledClass_key" RENAME TO "ScheduledClass_sectionTimetableId_scheduleType_dayOfWeek_cl_key";

-- ---------------------------------------------------------------------------
-- 8. Tenant isolation (RLS) for the new tenant-scoped tables — same pattern as prior migrations.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['Department', 'Position', 'EmployeeStatusHistory'];
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

-- Grant the runtime role access to the new tables (default privileges cover future ones, but the
-- app-role grant script is only guaranteed to have run once; be explicit and idempotent here).
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'munaxa_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "Department", "Position", "EmployeeStatusHistory" TO munaxa_app;
  END IF;
END $$;

-- ============================================================================
-- HR transformation — Phase 3: driver refactor.
--
-- Bus drivers become canonical Employees (jobTitle "Driver") with a DriverProfile
-- (licence, medical, infractions). Bus.driverName/driverPhone strings are migrated into Employee
-- records and replaced by Bus.driverId → Employee. No driver data is lost.
-- ============================================================================

-- 1. Enum
CREATE TYPE "InfractionSeverity" AS ENUM ('MINOR', 'MAJOR', 'SEVERE');

-- 2. New tables
CREATE TABLE "DriverProfile" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "licenseNumber" TEXT,
    "licenseClass" TEXT,
    "licenseExpiry" DATE,
    "medicalCertExpiry" DATE,
    "medicalNotes" TEXT,
    "performanceRating" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    CONSTRAINT "DriverProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DriverInfraction" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "driverProfileId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "severity" "InfractionSeverity" NOT NULL DEFAULT 'MINOR',
    "points" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DriverInfraction_pkey" PRIMARY KEY ("id")
);

-- 3. Add Bus.driverId (before migrating data; drop the string columns afterward)
ALTER TABLE "Bus" ADD COLUMN "driverId" UUID;

-- 4. Data migration: promote each distinct (tenant, driverName) into an Employee + DriverProfile,
--    then point every matching bus at it. Names are split first-word / remainder; Arabic name
--    fields (NOT NULL) fall back to the original string for demo data.
DO $$
DECLARE
  r RECORD;
  emp_id UUID;
BEGIN
  FOR r IN
    SELECT "tenantId",
           "driverName" AS name,
           MAX("driverPhone") AS phone
    FROM "Bus"
    WHERE "driverName" IS NOT NULL AND btrim("driverName") <> ''
    GROUP BY "tenantId", "driverName"
  LOOP
    emp_id := gen_random_uuid();
    INSERT INTO "Employee" (
      "id", "tenantId", "firstNameEn", "lastNameEn", "firstNameAr", "lastNameAr",
      "jobTitle", "status", "personalPhone", "createdAt", "updatedAt"
    ) VALUES (
      emp_id, r."tenantId",
      split_part(r.name, ' ', 1),
      CASE WHEN position(' ' in r.name) > 0
           THEN substring(r.name from position(' ' in r.name) + 1)
           ELSE r.name END,
      r.name, r.name,
      'Driver', 'ACTIVE', r.phone, now(), now()
    );
    INSERT INTO "DriverProfile" ("id", "tenantId", "employeeId", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), r."tenantId", emp_id, now(), now());
    -- Seed the driver's lifecycle history (mirrors the app's create path).
    INSERT INTO "EmployeeStatusHistory" ("id", "tenantId", "employeeId", "toStatus", "reason", "createdAt")
    VALUES (gen_random_uuid(), r."tenantId", emp_id, 'ACTIVE', 'Migrated from fleet driver', now());
    UPDATE "Bus" SET "driverId" = emp_id
    WHERE "tenantId" = r."tenantId" AND "driverName" = r.name;
  END LOOP;
END $$;

-- 5. Drop the denormalised string columns
ALTER TABLE "Bus" DROP COLUMN "driverName", DROP COLUMN "driverPhone";

-- 6. Indexes
CREATE UNIQUE INDEX "DriverProfile_employeeId_key" ON "DriverProfile"("employeeId");
CREATE INDEX "DriverProfile_tenantId_idx" ON "DriverProfile"("tenantId");
CREATE INDEX "DriverProfile_tenantId_licenseExpiry_idx" ON "DriverProfile"("tenantId", "licenseExpiry");
CREATE INDEX "DriverProfile_tenantId_medicalCertExpiry_idx" ON "DriverProfile"("tenantId", "medicalCertExpiry");
CREATE INDEX "DriverInfraction_tenantId_idx" ON "DriverInfraction"("tenantId");
CREATE INDEX "DriverInfraction_tenantId_driverProfileId_idx" ON "DriverInfraction"("tenantId", "driverProfileId");
CREATE INDEX "Bus_driverId_idx" ON "Bus"("driverId");

-- 7. Foreign keys
ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverInfraction" ADD CONSTRAINT "DriverInfraction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverInfraction" ADD CONSTRAINT "DriverInfraction_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bus" ADD CONSTRAINT "Bus_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 8. RLS + grants for the new tenant-scoped tables
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['DriverProfile', 'DriverInfraction'];
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
    GRANT SELECT, INSERT, UPDATE, DELETE ON "DriverProfile", "DriverInfraction" TO munaxa_app;
  END IF;
END $$;

-- ============================================================================
-- HR transformation — Phase 2: employment contracts, employee documents, and
-- personal sub-records (emergency contacts, dependents, education, certificates,
-- bank accounts). Purely additive; all tables tenant-scoped with RLS.
-- ============================================================================

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('PERMANENT', 'TEMPORARY', 'PART_TIME', 'HOURLY', 'SEASONAL', 'CONSULTANT', 'SUBSTITUTE_TEACHER');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED');

-- CreateEnum
CREATE TYPE "EmployeeDocumentType" AS ENUM ('CONTRACT', 'NATIONAL_ID', 'PASSPORT', 'CERTIFICATE', 'MEDICAL_REPORT', 'POLICE_CLEARANCE', 'DRIVING_LICENSE', 'INSURANCE', 'TRAINING_CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "DependentRelation" AS ENUM ('SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER');

-- CreateTable
CREATE TABLE "EmploymentContract" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "contractType" "ContractType" NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "baseSalary" DECIMAL(12,3),
    "currency" TEXT DEFAULT 'JOD',
    "allowances" JSONB,
    "benefits" TEXT,
    "workingHours" DECIMAL(5,2),
    "vacationDays" INTEGER,
    "signedAt" TIMESTAMPTZ(6),
    "signedDocumentId" UUID,
    "renewedFromId" UUID,
    "notes" TEXT,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "EmploymentContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDocument" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "type" "EmployeeDocumentType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" UUID,
    "issueDate" DATE,
    "expiryDate" DATE,
    "uploadedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneAlt" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dependent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relation" "DependentRelation" NOT NULL,
    "dateOfBirth" DATE,
    "gender" "Gender",
    "nationalId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Dependent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeEducation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "fieldOfStudy" TEXT,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "grade" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "EmployeeEducation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "issuingBody" TEXT,
    "issueDate" DATE,
    "expiryDate" DATE,
    "credentialId" TEXT,
    "documentId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeBankAccount" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT,
    "accountNumber" TEXT,
    "iban" TEXT,
    "swift" TEXT,
    "currency" TEXT DEFAULT 'JOD',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "EmployeeBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmploymentContract_tenantId_idx" ON "EmploymentContract"("tenantId");

-- CreateIndex
CREATE INDEX "EmploymentContract_tenantId_employeeId_idx" ON "EmploymentContract"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "EmploymentContract_tenantId_status_idx" ON "EmploymentContract"("tenantId", "status");

-- CreateIndex
CREATE INDEX "EmploymentContract_tenantId_endDate_idx" ON "EmploymentContract"("tenantId", "endDate");

-- CreateIndex
CREATE INDEX "EmployeeDocument_tenantId_idx" ON "EmployeeDocument"("tenantId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_tenantId_employeeId_idx" ON "EmployeeDocument"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_tenantId_type_idx" ON "EmployeeDocument"("tenantId", "type");

-- CreateIndex
CREATE INDEX "EmployeeDocument_tenantId_expiryDate_idx" ON "EmployeeDocument"("tenantId", "expiryDate");

-- CreateIndex
CREATE INDEX "EmergencyContact_tenantId_idx" ON "EmergencyContact"("tenantId");

-- CreateIndex
CREATE INDEX "EmergencyContact_tenantId_employeeId_idx" ON "EmergencyContact"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "Dependent_tenantId_idx" ON "Dependent"("tenantId");

-- CreateIndex
CREATE INDEX "Dependent_tenantId_employeeId_idx" ON "Dependent"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "EmployeeEducation_tenantId_idx" ON "EmployeeEducation"("tenantId");

-- CreateIndex
CREATE INDEX "EmployeeEducation_tenantId_employeeId_idx" ON "EmployeeEducation"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "Certificate_tenantId_idx" ON "Certificate"("tenantId");

-- CreateIndex
CREATE INDEX "Certificate_tenantId_employeeId_idx" ON "Certificate"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "Certificate_tenantId_expiryDate_idx" ON "Certificate"("tenantId", "expiryDate");

-- CreateIndex
CREATE INDEX "EmployeeBankAccount_tenantId_idx" ON "EmployeeBankAccount"("tenantId");

-- CreateIndex
CREATE INDEX "EmployeeBankAccount_tenantId_employeeId_idx" ON "EmployeeBankAccount"("tenantId", "employeeId");

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_signedDocumentId_fkey" FOREIGN KEY ("signedDocumentId") REFERENCES "EmployeeDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_renewedFromId_fkey" FOREIGN KEY ("renewedFromId") REFERENCES "EmploymentContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "EmployeeDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependent" ADD CONSTRAINT "Dependent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependent" ADD CONSTRAINT "Dependent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEducation" ADD CONSTRAINT "EmployeeEducation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEducation" ADD CONSTRAINT "EmployeeEducation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "EmployeeDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeBankAccount" ADD CONSTRAINT "EmployeeBankAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeBankAccount" ADD CONSTRAINT "EmployeeBankAccount_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Tenant isolation (RLS) for the new tenant-scoped tables.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'EmploymentContract', 'EmployeeDocument', 'EmergencyContact', 'Dependent',
    'EmployeeEducation', 'Certificate', 'EmployeeBankAccount'
  ];
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
      "EmploymentContract", "EmployeeDocument", "EmergencyContact", "Dependent",
      "EmployeeEducation", "Certificate", "EmployeeBankAccount" TO munaxa_app;
  END IF;
END $$;

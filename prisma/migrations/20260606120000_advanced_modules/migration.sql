-- CreateEnum
CREATE TYPE "BookLoanStatus" AS ENUM ('ACTIVE', 'RETURNED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "InventoryTxnType" AS ENUM ('IN', 'OUT', 'ADJUST');

-- CreateEnum
CREATE TYPE "ClinicOutcome" AS ENUM ('RESOLVED', 'SENT_HOME', 'REFERRED', 'HOSPITALIZED');

-- CreateTable
CREATE TABLE "BusRoute" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "BusRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bus" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "routeId" UUID,
    "plateNumber" TEXT NOT NULL,
    "label" TEXT,
    "capacity" INTEGER,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "lastLat" DOUBLE PRECISION,
    "lastLng" DOUBLE PRECISION,
    "lastSeenAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Bus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusStop" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "routeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "pickupTime" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentBusAssignment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "routeId" UUID NOT NULL,
    "stopId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentBusAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryBook" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "isbn" TEXT,
    "category" TEXT,
    "copiesTotal" INTEGER NOT NULL DEFAULT 1,
    "copiesAvailable" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "LibraryBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookLoan" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "studentId" UUID,
    "borrowerName" TEXT,
    "status" "BookLoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "borrowedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATE NOT NULL,
    "returnedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BookLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT,
    "unit" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER,
    "location" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "type" "InventoryTxnType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "recordedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentMedicalRecord" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "bloodType" TEXT,
    "allergies" TEXT,
    "chronicConditions" TEXT,
    "medications" TEXT,
    "emergencyContact" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StudentMedicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicVisit" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "symptoms" TEXT,
    "treatment" TEXT,
    "temperature" DECIMAL(4,1),
    "outcome" "ClinicOutcome" NOT NULL DEFAULT 'RESOLVED',
    "recordedById" UUID,
    "visitedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusRoute_tenantId_idx" ON "BusRoute"("tenantId");

-- CreateIndex
CREATE INDEX "Bus_tenantId_idx" ON "Bus"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Bus_tenantId_plateNumber_key" ON "Bus"("tenantId", "plateNumber");

-- CreateIndex
CREATE INDEX "BusStop_tenantId_idx" ON "BusStop"("tenantId");

-- CreateIndex
CREATE INDEX "BusStop_tenantId_routeId_idx" ON "BusStop"("tenantId", "routeId");

-- CreateIndex
CREATE INDEX "StudentBusAssignment_tenantId_idx" ON "StudentBusAssignment"("tenantId");

-- CreateIndex
CREATE INDEX "StudentBusAssignment_tenantId_routeId_idx" ON "StudentBusAssignment"("tenantId", "routeId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentBusAssignment_studentId_routeId_key" ON "StudentBusAssignment"("studentId", "routeId");

-- CreateIndex
CREATE INDEX "LibraryBook_tenantId_idx" ON "LibraryBook"("tenantId");

-- CreateIndex
CREATE INDEX "BookLoan_tenantId_idx" ON "BookLoan"("tenantId");

-- CreateIndex
CREATE INDEX "BookLoan_tenantId_bookId_idx" ON "BookLoan"("tenantId", "bookId");

-- CreateIndex
CREATE INDEX "BookLoan_tenantId_status_idx" ON "BookLoan"("tenantId", "status");

-- CreateIndex
CREATE INDEX "InventoryItem_tenantId_idx" ON "InventoryItem"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_tenantId_sku_key" ON "InventoryItem"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "InventoryTransaction_tenantId_idx" ON "InventoryTransaction"("tenantId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_tenantId_itemId_idx" ON "InventoryTransaction"("tenantId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentMedicalRecord_studentId_key" ON "StudentMedicalRecord"("studentId");

-- CreateIndex
CREATE INDEX "StudentMedicalRecord_tenantId_idx" ON "StudentMedicalRecord"("tenantId");

-- CreateIndex
CREATE INDEX "ClinicVisit_tenantId_idx" ON "ClinicVisit"("tenantId");

-- CreateIndex
CREATE INDEX "ClinicVisit_tenantId_studentId_idx" ON "ClinicVisit"("tenantId", "studentId");

-- AddForeignKey
ALTER TABLE "BusRoute" ADD CONSTRAINT "BusRoute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bus" ADD CONSTRAINT "Bus_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bus" ADD CONSTRAINT "Bus_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "BusRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusStop" ADD CONSTRAINT "BusStop_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusStop" ADD CONSTRAINT "BusStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "BusRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBusAssignment" ADD CONSTRAINT "StudentBusAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBusAssignment" ADD CONSTRAINT "StudentBusAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBusAssignment" ADD CONSTRAINT "StudentBusAssignment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "BusRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBusAssignment" ADD CONSTRAINT "StudentBusAssignment_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "BusStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryBook" ADD CONSTRAINT "LibraryBook_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookLoan" ADD CONSTRAINT "BookLoan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookLoan" ADD CONSTRAINT "BookLoan_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LibraryBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookLoan" ADD CONSTRAINT "BookLoan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMedicalRecord" ADD CONSTRAINT "StudentMedicalRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMedicalRecord" ADD CONSTRAINT "StudentMedicalRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicVisit" ADD CONSTRAINT "ClinicVisit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicVisit" ADD CONSTRAINT "ClinicVisit_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ============================================================================
-- Tenant isolation (RLS) for Advanced Module tables (Phase 14).
-- ============================================================================
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'BusRoute', 'Bus', 'BusStop', 'StudentBusAssignment',
    'LibraryBook', 'BookLoan',
    'InventoryItem', 'InventoryTransaction',
    'StudentMedicalRecord', 'ClinicVisit'
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

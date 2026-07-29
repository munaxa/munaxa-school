-- CreateEnum
CREATE TYPE "PresenceEventType" AS ENUM ('GATE_IN', 'GATE_OUT', 'RECEPTION_CHECKIN', 'RECEPTION_CHECKOUT');

-- CreateEnum
CREATE TYPE "PresenceMethod" AS ENUM ('NFC', 'RFID', 'QR', 'MANUAL', 'FACE', 'BUS');

-- CreateEnum
CREATE TYPE "BusEventType" AS ENUM ('BOARD_AM', 'ARRIVE_SCHOOL', 'BOARD_PM', 'ARRIVE_HOME');

-- CreateEnum
CREATE TYPE "TransportMethod" AS ENUM ('NFC', 'RFID', 'QR', 'MANUAL');

-- CreateEnum
CREATE TYPE "AttendanceSourceMode" AS ENUM ('TEACHER_ONLY', 'GATE_ARRIVAL', 'BUS_ARRIVAL', 'HYBRID');

-- CreateTable
CREATE TABLE "StudentPresenceEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "eventType" "PresenceEventType" NOT NULL,
    "method" "PresenceMethod" NOT NULL DEFAULT 'MANUAL',
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "deviceId" TEXT,
    "clientRef" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StudentPresenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusAttendanceEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "busId" UUID NOT NULL,
    "eventType" "BusEventType" NOT NULL,
    "method" "TransportMethod" NOT NULL DEFAULT 'NFC',
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "clientRef" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BusAttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSourceConfig" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "mode" "AttendanceSourceMode" NOT NULL DEFAULT 'TEACHER_ONLY',
    "busMethod" "TransportMethod" NOT NULL DEFAULT 'NFC',
    "presenceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "transportEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AttendanceSourceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentPresenceEvent_tenantId_idx" ON "StudentPresenceEvent"("tenantId");

-- CreateIndex
CREATE INDEX "StudentPresenceEvent_tenantId_studentId_idx" ON "StudentPresenceEvent"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "StudentPresenceEvent_tenantId_occurredAt_idx" ON "StudentPresenceEvent"("tenantId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPresenceEvent_tenantId_clientRef_key" ON "StudentPresenceEvent"("tenantId", "clientRef");

-- CreateIndex
CREATE INDEX "BusAttendanceEvent_tenantId_idx" ON "BusAttendanceEvent"("tenantId");

-- CreateIndex
CREATE INDEX "BusAttendanceEvent_tenantId_studentId_idx" ON "BusAttendanceEvent"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "BusAttendanceEvent_tenantId_busId_idx" ON "BusAttendanceEvent"("tenantId", "busId");

-- CreateIndex
CREATE INDEX "BusAttendanceEvent_tenantId_occurredAt_idx" ON "BusAttendanceEvent"("tenantId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusAttendanceEvent_tenantId_clientRef_key" ON "BusAttendanceEvent"("tenantId", "clientRef");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSourceConfig_tenantId_key" ON "AttendanceSourceConfig"("tenantId");

-- AddForeignKey
ALTER TABLE "StudentPresenceEvent" ADD CONSTRAINT "StudentPresenceEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPresenceEvent" ADD CONSTRAINT "StudentPresenceEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusAttendanceEvent" ADD CONSTRAINT "BusAttendanceEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusAttendanceEvent" ADD CONSTRAINT "BusAttendanceEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusAttendanceEvent" ADD CONSTRAINT "BusAttendanceEvent_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSourceConfig" ADD CONSTRAINT "AttendanceSourceConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ============================================================================
-- Tenant isolation (RLS) for the new presence/transport tables — same pattern as every module.
-- ============================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['StudentPresenceEvent','BusAttendanceEvent','AttendanceSourceConfig']
  LOOP
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

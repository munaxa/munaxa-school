-- Registration → Fleet integration (additive, backwards-compatible).
-- Introduces geographic Area master data and links students to it, plus a flag that
-- records transportation demand captured at registration. Fleet remains the
-- operational source of truth (BusRoute / StudentBusAssignment) — these columns only
-- describe where a student lives and whether transport was requested.

-- 1) Area master data.
CREATE TABLE "Area" (
  "id"                      UUID NOT NULL,
  "tenantId"                UUID NOT NULL,
  "name"                    TEXT NOT NULL,
  "transportationAvailable" BOOLEAN NOT NULL DEFAULT true,
  "active"                  BOOLEAN NOT NULL DEFAULT true,
  "notes"                   TEXT,
  "createdAt"               TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMPTZ(6) NOT NULL,
  "deletedAt"               TIMESTAMPTZ(6),
  CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Area"
  ADD CONSTRAINT "Area_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Area_tenantId_name_key" ON "Area" ("tenantId", "name");
CREATE INDEX "Area_tenantId_idx" ON "Area" ("tenantId");
CREATE INDEX "Area_tenantId_active_idx" ON "Area" ("tenantId", "active");

-- 2) Student transportation demand (additive). Defaults keep existing rows valid:
--    no area, transport not requested → no change to behaviour until registration sets them.
ALTER TABLE "Student" ADD COLUMN "areaId" UUID;
ALTER TABLE "Student" ADD COLUMN "transportRequested" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Student"
  ADD CONSTRAINT "Student_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Student_tenantId_areaId_idx" ON "Student" ("tenantId", "areaId");
CREATE INDEX "Student_tenantId_transportRequested_idx" ON "Student" ("tenantId", "transportRequested");

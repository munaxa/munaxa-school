-- Transport fares are per route (one row per route + year): they hold the two-way (round trip)
-- total plus the one-way price as a percentage of that total. The route is the shared fleet
-- BusRoute, so identity is the same in the Fleet and Fee-configuration tabs. Direction (one/two
-- way) is chosen at admission, not stored on the fare — which avoids duplicate rows per route.
ALTER TABLE "TransportFare" ADD COLUMN "routeId" UUID;
ALTER TABLE "TransportFare" ADD COLUMN "oneWayPct" DECIMAL(5, 2) NOT NULL DEFAULT 100;

ALTER TABLE "TransportFare"
  ADD CONSTRAINT "TransportFare_routeId_fkey"
  FOREIGN KEY ("routeId") REFERENCES "BusRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One fare per route + year now; drop the old per-direction uniqueness and the direction column.
DROP INDEX IF EXISTS "TransportFare_tenantId_academicYearId_direction_key";
ALTER TABLE "TransportFare" DROP COLUMN "direction";

CREATE UNIQUE INDEX "TransportFare_tenantId_academicYearId_routeId_key"
  ON "TransportFare" ("tenantId", "academicYearId", "routeId");
CREATE INDEX "TransportFare_routeId_idx" ON "TransportFare" ("routeId");

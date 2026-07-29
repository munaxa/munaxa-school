-- Area → Route mapping (additive). The transportation department maps each area to the
-- route that serves it, so registration can resolve the route automatically. Billing still
-- flows through TransportFare; transportFee here is an optional per-area override only.

ALTER TABLE "Area" ADD COLUMN "routeId" UUID;
ALTER TABLE "Area" ADD COLUMN "academicYearId" UUID;
ALTER TABLE "Area" ADD COLUMN "transportFee" DECIMAL(12, 3);

ALTER TABLE "Area"
  ADD CONSTRAINT "Area_routeId_fkey"
  FOREIGN KEY ("routeId") REFERENCES "BusRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Area"
  ADD CONSTRAINT "Area_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Area_routeId_idx" ON "Area" ("routeId");

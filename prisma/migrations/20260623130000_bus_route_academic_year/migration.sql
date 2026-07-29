-- Group fleet routes by academic year (e.g. 2026/2027). Nullable so existing routes stay
-- "unscheduled" until assigned a year.
ALTER TABLE "BusRoute" ADD COLUMN "academicYearId" UUID;

ALTER TABLE "BusRoute"
  ADD CONSTRAINT "BusRoute_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BusRoute_tenantId_academicYearId_idx" ON "BusRoute" ("tenantId", "academicYearId");

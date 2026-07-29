-- A student may belong to only one bus assignment (one route + one stop), so they can't end up on
-- two different stops. Replace the per-route uniqueness with a per-student one.
DROP INDEX IF EXISTS "StudentBusAssignment_studentId_routeId_key";
CREATE UNIQUE INDEX "StudentBusAssignment_tenantId_studentId_key"
  ON "StudentBusAssignment" ("tenantId", "studentId");

-- Two stops on the same route may not share a pickup time (partial: only when a time is set).
CREATE UNIQUE INDEX "BusStop_routeId_pickupTime_key"
  ON "BusStop" ("routeId", "pickupTime") WHERE "pickupTime" IS NOT NULL;

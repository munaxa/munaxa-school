-- Routes can be disabled (still listed everywhere, but shown as disabled).
ALTER TABLE "BusRoute" ADD COLUMN "disabledAt" TIMESTAMPTZ(6);

-- A bus serves a specific trip of its route; students ride a specific trip too. 1 = 1st, 2 = 2nd.
ALTER TABLE "Bus" ADD COLUMN "tripRound" INTEGER;
ALTER TABLE "StudentBusAssignment" ADD COLUMN "tripRound" INTEGER;

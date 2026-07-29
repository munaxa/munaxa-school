-- Most routes run two trips ("rounds"). Store the 1st/2nd round trip times on the route.
ALTER TABLE "BusRoute" ADD COLUMN "round1Time" TEXT;
ALTER TABLE "BusRoute" ADD COLUMN "round2Time" TEXT;

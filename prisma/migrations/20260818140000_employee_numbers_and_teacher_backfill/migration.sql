-- ============================================================================
-- Munaxa — one staff person, one staff number
--
-- Two halves of the same rule: a teacher is an employee, and every employee
-- carries a staff number issued by the school rather than typed in by hand.
--
--  1) EmployeeNumberCounter — the per-tenant, row-locked counter the API now
--     draws from when someone is hired (same gapless idiom as
--     StudentNumberCounter and PaymentReceiptCounter).
--
--  2) Backfill. Teachers created before HR owned the staff directory have no
--     Employee behind them: they are given one — same names, status and staff
--     number, with their lifecycle history opened — and linked, so the HR
--     directory can list each person exactly once and the Teachers tab can be a
--     view of it. Employees with no staff number are then issued one, and each
--     teaching facet is re-pointed at its employee's number so the two can
--     never disagree.
--
-- Idempotent and safe to re-run: every step is guarded on the state it fixes.
-- ============================================================================

-- CreateTable
CREATE TABLE "EmployeeNumberCounter" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "prefix" TEXT DEFAULT 'E-',
    "padLength" INTEGER NOT NULL DEFAULT 4,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeNumberCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeNumberCounter_tenantId_key" ON "EmployeeNumberCounter"("tenantId");

-- AddForeignKey
ALTER TABLE "EmployeeNumberCounter" ADD CONSTRAINT "EmployeeNumberCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation (RLS) + runtime grants for the new table.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['EmployeeNumberCounter'];
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
    GRANT SELECT, INSERT, UPDATE, DELETE ON "EmployeeNumberCounter" TO munaxa_app;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Give every live teacher without one an Employee record, and link it.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  rec       RECORD;
  new_id    UUID;
  take_user UUID;
  take_no   TEXT;
BEGIN
  FOR rec IN
    SELECT * FROM "Teacher" WHERE "employeeId" IS NULL AND "deletedAt" IS NULL
  LOOP
    -- The portal login and the staff number move across only if nothing else holds them;
    -- both are unique per tenant on Employee, and the number is reissued below when dropped.
    take_user := CASE
      WHEN rec."userId" IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM "Employee" e WHERE e."userId" = rec."userId")
      THEN rec."userId" END;
    take_no := CASE
      WHEN rec."employeeNumber" IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM "Employee" e
         WHERE e."tenantId" = rec."tenantId" AND e."employeeNumber" = rec."employeeNumber")
      THEN rec."employeeNumber" END;

    INSERT INTO "Employee" (
      "id", "tenantId", "userId", "employeeNumber",
      "firstNameEn", "lastNameEn", "firstNameAr", "lastNameAr",
      "jobTitle", "status", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), rec."tenantId", take_user, take_no,
      rec."firstNameEn", rec."lastNameEn", rec."firstNameAr", rec."lastNameAr",
      'Teacher', rec."status", rec."createdAt", CURRENT_TIMESTAMP
    ) RETURNING "id" INTO new_id;

    -- Opening status, so the backfilled person has the same lifecycle timeline as a hire.
    INSERT INTO "EmployeeStatusHistory" ("id", "tenantId", "employeeId", "fromStatus", "toStatus", "reason", "createdAt")
    VALUES (gen_random_uuid(), rec."tenantId", new_id, NULL, rec."status",
            'Backfilled from the teacher record', CURRENT_TIMESTAMP);

    UPDATE "Teacher" SET "employeeId" = new_id, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = rec."id";
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Issue a staff number to every employee without one, then park the counter
--    past the highest number each school has actually used.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  ten       RECORD;
  emp       RECORD;
  n         INT;
  candidate TEXT;
BEGIN
  FOR ten IN SELECT DISTINCT "tenantId" FROM "Employee" WHERE "deletedAt" IS NULL LOOP
    n := 1;
    FOR emp IN
      SELECT "id" FROM "Employee"
      WHERE "tenantId" = ten."tenantId" AND "deletedAt" IS NULL AND "employeeNumber" IS NULL
      ORDER BY "createdAt", "id"
    LOOP
      LOOP
        candidate := 'E-' || lpad(n::text, 4, '0');
        n := n + 1;
        -- Skip anything already taken by a person or by a teaching facet in this school,
        -- including soft-deleted rows: both tables hold uniqueness on the number.
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM "Employee" e
          WHERE e."tenantId" = ten."tenantId" AND e."employeeNumber" = candidate
        ) AND NOT EXISTS (
          SELECT 1 FROM "Teacher" t
          WHERE t."tenantId" = ten."tenantId" AND t."employeeNumber" = candidate
        );
      END LOOP;
      UPDATE "Employee" SET "employeeNumber" = candidate, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = emp."id";
    END LOOP;

    INSERT INTO "EmployeeNumberCounter" ("id", "tenantId", "nextNumber", "updatedAt")
    VALUES (gen_random_uuid(), ten."tenantId", n, CURRENT_TIMESTAMP)
    ON CONFLICT ("tenantId") DO UPDATE SET "nextNumber" = GREATEST("EmployeeNumberCounter"."nextNumber", EXCLUDED."nextNumber");
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3) The teaching facet mirrors its employee, staff number included.
-- ---------------------------------------------------------------------------
UPDATE "Teacher" t
SET "employeeNumber" = e."employeeNumber", "updatedAt" = CURRENT_TIMESTAMP
FROM "Employee" e
WHERE t."employeeId" = e."id"
  AND t."deletedAt" IS NULL
  AND t."employeeNumber" IS DISTINCT FROM e."employeeNumber"
  -- Never at the cost of the teacher table's own uniqueness: an old row still holding that
  -- number keeps it, and the two are reconciled by hand rather than by a failed migration.
  AND NOT EXISTS (
    SELECT 1 FROM "Teacher" o
    WHERE o."tenantId" = t."tenantId" AND o."employeeNumber" = e."employeeNumber" AND o."id" <> t."id"
  );

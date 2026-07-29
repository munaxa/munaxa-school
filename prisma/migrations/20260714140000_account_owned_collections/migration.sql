-- Account-owned collections. A CollectionsCase now belongs to the FINANCIAL ACCOUNT (Payer), not one
-- student — one case per account, shared by all its students. `accountId` stays as a legacy
-- per-student fallback key for accounts that have no payer yet.
--
-- Existing per-student cases are consolidated: for each payer that has one or more student cases, ONE
-- case is kept (the most severe, then oldest), the siblings' promises + dunning events are re-pointed
-- to it, notes/lawyerRef merged, and the duplicate cases deleted. History is preserved; no case is
-- lost. Cases whose account has no payer are left untouched (accountId-keyed).

-- 1) Schema: add payerId, relax accountId to nullable.
ALTER TABLE "CollectionsCase" ADD COLUMN "payerId" UUID;
ALTER TABLE "CollectionsCase" ALTER COLUMN "accountId" DROP NOT NULL;

-- 2) Point each existing case at its account's payer (where the account has one).
UPDATE "CollectionsCase" c
SET "payerId" = sfa."payerId"
FROM "StudentFinancialAccount" sfa
WHERE sfa.id = c."accountId" AND sfa."payerId" IS NOT NULL;

-- 3) Consolidate duplicates: for each payer with >1 case, keep the most-severe/oldest as primary,
--    re-point children's promises + events to it, merge notes/lawyerRef, delete the children.
DO $$
DECLARE
  grp RECORD;
  primary_id uuid;
  merged_notes text;
  merged_lawyer text;
BEGIN
  FOR grp IN
    SELECT "payerId" AS pid
    FROM "CollectionsCase"
    WHERE "payerId" IS NOT NULL
    GROUP BY "payerId"
    HAVING COUNT(*) > 1
  LOOP
    -- Primary = most severe status (LEGAL > PROMISE_TO_PAY > OPEN > RESOLVED), then oldest.
    SELECT id INTO primary_id
    FROM "CollectionsCase"
    WHERE "payerId" = grp.pid
    ORDER BY
      CASE status
        WHEN 'LEGAL' THEN 0
        WHEN 'PROMISE_TO_PAY' THEN 1
        WHEN 'OPEN' THEN 2
        WHEN 'RESOLVED' THEN 3
        ELSE 4
      END,
      "openedAt" ASC
    LIMIT 1;

    -- Merge notes + lawyerRef from the siblings into the primary.
    SELECT string_agg(notes, E'\n---\n') INTO merged_notes
    FROM "CollectionsCase" WHERE "payerId" = grp.pid AND notes IS NOT NULL;
    SELECT string_agg(DISTINCT "lawyerRef", '; ') INTO merged_lawyer
    FROM "CollectionsCase" WHERE "payerId" = grp.pid AND "lawyerRef" IS NOT NULL;
    UPDATE "CollectionsCase" SET notes = merged_notes, "lawyerRef" = merged_lawyer
    WHERE id = primary_id;

    -- Re-point history from the sibling cases to the primary, then delete the siblings.
    UPDATE "PromiseToPay" SET "caseId" = primary_id
    WHERE "caseId" IN (SELECT id FROM "CollectionsCase" WHERE "payerId" = grp.pid AND id <> primary_id);
    UPDATE "DunningEvent" SET "caseId" = primary_id
    WHERE "caseId" IN (SELECT id FROM "CollectionsCase" WHERE "payerId" = grp.pid AND id <> primary_id);
    DELETE FROM "CollectionsCase" WHERE "payerId" = grp.pid AND id <> primary_id;
  END LOOP;
END $$;

-- 4) Ownership moved to the payer: clear the legacy accountId on payer-keyed cases so the case is not
--    also anchored to a single student.
UPDATE "CollectionsCase" SET "accountId" = NULL WHERE "payerId" IS NOT NULL;

-- 5) Constraints: the old accountId unique index is replaced by two nullable-unique keys.
DROP INDEX IF EXISTS "CollectionsCase_accountId_key";
CREATE UNIQUE INDEX "CollectionsCase_payerId_key" ON "CollectionsCase"("payerId");
CREATE UNIQUE INDEX "CollectionsCase_accountId_key" ON "CollectionsCase"("accountId");

-- 6) FK for payerId.
ALTER TABLE "CollectionsCase"
  ADD CONSTRAINT "CollectionsCase_payerId_fkey"
  FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

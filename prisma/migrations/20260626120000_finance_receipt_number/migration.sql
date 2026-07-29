-- Tier 1 finance traceability: gapless per-tenant official receipt numbers for verified payments.
-- A receipt number represents confirmed money, so it is allocated on VERIFY (rejected/pending
-- payments never consume a number). The counter mirrors EInvoiceCounter (row-locked, lazy-created).

ALTER TABLE "Transaction" ADD COLUMN "receiptNo" INTEGER;

-- Unique per tenant; NULLs are allowed (unverified payments have no receipt yet) and Postgres
-- permits multiple NULLs under a UNIQUE constraint.
CREATE UNIQUE INDEX "Transaction_tenantId_receiptNo_key" ON "Transaction" ("tenantId", "receiptNo");

CREATE TABLE "FinanceReceiptCounter" (
  "id"            UUID NOT NULL,
  "tenantId"     UUID NOT NULL,
  "nextReceiptNo" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "FinanceReceiptCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceReceiptCounter_tenantId_key" ON "FinanceReceiptCounter" ("tenantId");

ALTER TABLE "FinanceReceiptCounter"
  ADD CONSTRAINT "FinanceReceiptCounter_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: give every already-verified payment a stable receipt number (ordered by creation),
-- and seed each tenant's counter to continue after the highest backfilled number.
WITH numbered AS (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt", "id") AS rn
  FROM "Transaction"
  WHERE "status" = 'VERIFIED'
)
UPDATE "Transaction" t
SET "receiptNo" = numbered.rn
FROM numbered
WHERE t."id" = numbered."id";

INSERT INTO "FinanceReceiptCounter" ("id", "tenantId", "nextReceiptNo")
SELECT gen_random_uuid(), "tenantId", MAX("receiptNo") + 1
FROM "Transaction"
WHERE "receiptNo" IS NOT NULL
GROUP BY "tenantId";

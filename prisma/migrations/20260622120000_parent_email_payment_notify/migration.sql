-- Parent contact email: lets the school notify front-desk-registered parents
-- (who have no User login) when a payment is settled in Finance.
-- IF NOT EXISTS keeps this safe to re-apply on an environment where the column
-- was already added out-of-band (e.g. staging) without breaking `migrate deploy`.
ALTER TABLE "Parent" ADD COLUMN IF NOT EXISTS "email" TEXT;

-- Record whether/when a parent was emailed that this settled payment was received.
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "parentNotifiedAt" TIMESTAMPTZ(6);

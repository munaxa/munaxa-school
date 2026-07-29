-- Separation of duties for fee modifications: by default the user who applies a fee
-- modification cannot approve it. Schools with a single finance person can opt out.
ALTER TABLE "BillingPolicy" ADD COLUMN "allowSelfFeeApproval" BOOLEAN NOT NULL DEFAULT false;

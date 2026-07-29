-- The registration fee is normally paid at registration and billed as its own one-off charge. When
-- it is NOT paid up front it is folded into the monthly installment plan instead. Track that choice
-- on the enrolment so the ledger and the (reproducible) registration-agreement schedule agree.
-- Existing rows default to true (the usual case: paid at registration).
ALTER TABLE "Enrollment" ADD COLUMN "registrationFeePaid" BOOLEAN NOT NULL DEFAULT true;

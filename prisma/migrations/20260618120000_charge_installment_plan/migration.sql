-- Group a parent's installment charges under one plan id (one active plan per student).
ALTER TABLE "Charge" ADD COLUMN "installmentPlanId" UUID;

-- CreateIndex
CREATE INDEX "Charge_tenantId_installmentPlanId_idx" ON "Charge"("tenantId", "installmentPlanId");

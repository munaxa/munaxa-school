-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'CLOSED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "PaymentPlanCadence" AS ENUM ('MONTHLY', 'WEEKLY', 'QUARTERLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PaymentPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('SCHEDULED', 'PARTIAL', 'PAID', 'WAIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CreditSource" AS ENUM ('OVERPAYMENT', 'CREDIT_MEMO', 'SCHOLARSHIP', 'RETURN');

-- CreateEnum
CREATE TYPE "CollectionsCaseStatus" AS ENUM ('OPEN', 'PROMISE_TO_PAY', 'LEGAL', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DunningEventType" AS ENUM ('REMINDER', 'NOTE', 'STATUS_CHANGE', 'PROMISE', 'ESCALATION');

-- AlterEnum
ALTER TYPE "AdjustmentType" ADD VALUE 'WRITE_OFF';

-- AlterEnum
ALTER TYPE "ChargeStatus" ADD VALUE 'WRITTEN_OFF';

-- DropForeignKey
ALTER TABLE "Charge" DROP CONSTRAINT "Charge_feePlanId_fkey";

-- DropForeignKey
ALTER TABLE "EInvoiceDocument" DROP CONSTRAINT "EInvoiceDocument_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "FeePlan" DROP CONSTRAINT "FeePlan_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceReceiptCounter" DROP CONSTRAINT "FinanceReceiptCounter_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentAllocation" DROP CONSTRAINT "PaymentAllocation_chargeId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentAllocation" DROP CONSTRAINT "PaymentAllocation_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentReminder" DROP CONSTRAINT "PaymentReminder_studentId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentReminder" DROP CONSTRAINT "PaymentReminder_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_chargeId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_tenantId_fkey";

-- DropIndex
DROP INDEX "Charge_tenantId_installmentPlanId_idx";

-- DropIndex
DROP INDEX "PaymentAllocation_tenantId_chargeId_idx";

-- DropIndex
DROP INDEX "PaymentAllocation_tenantId_transactionId_idx";

-- AlterTable
ALTER TABLE "Charge" DROP COLUMN "feePlanId",
DROP COLUMN "installmentPlanId",
ADD COLUMN     "academicYearId" UUID,
ADD COLUMN     "accountId" UUID NOT NULL,
ADD COLUMN     "campusId" UUID,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'JOD',
ADD COLUMN     "enrollmentId" UUID,
ADD COLUMN     "feeItemId" UUID,
ADD COLUMN     "gradeId" UUID;

-- AlterTable
ALTER TABLE "DocumentEmailLog" ALTER COLUMN "recipients" DROP DEFAULT,
ALTER COLUMN "cc" DROP DEFAULT,
ALTER COLUMN "bcc" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EInvoiceDocument" DROP COLUMN "transactionId",
ADD COLUMN     "paymentId" UUID;

-- AlterTable
ALTER TABLE "FeeAdjustment" ADD COLUMN     "accountId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "GeneratedDocument" DROP COLUMN "transactionId",
ADD COLUMN     "paymentId" UUID;

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PaymentAllocation" DROP COLUMN "chargeId",
DROP COLUMN "transactionId",
ADD COLUMN     "installmentId" UUID NOT NULL,
ADD COLUMN     "paymentId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "accountId" UUID NOT NULL,
ADD COLUMN     "payerId" UUID;

-- DropTable
DROP TABLE "FeePlan";

-- DropTable
DROP TABLE "FinanceReceiptCounter";

-- DropTable
DROP TABLE "PaymentReminder";

-- DropTable
DROP TABLE "Transaction";

-- DropEnum
DROP TYPE "FeeRecurrence";

-- DropEnum
DROP TYPE "TransactionStatus";

-- CreateTable
CREATE TABLE "Payer" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "parentId" UUID,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Payer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFinancialAccount" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "payerId" UUID,
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "openedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StudentFinancialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPlan" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "chargeId" UUID NOT NULL,
    "cadence" "PaymentPlanCadence" NOT NULL DEFAULT 'MONTHLY',
    "installments" INTEGER NOT NULL,
    "firstDueDate" DATE NOT NULL,
    "balloonFinal" BOOLEAN NOT NULL DEFAULT false,
    "status" "PaymentPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PaymentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "chargeId" UUID NOT NULL,
    "planId" UUID,
    "seq" INTEGER NOT NULL,
    "dueDate" DATE,
    "amount" DECIMAL(12,3) NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "payerId" UUID,
    "amount" DECIMAL(12,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "receiptKey" TEXT,
    "receiptNo" INTEGER,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "recordedById" UUID,
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMPTZ(6),
    "parentNotifiedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReceiptCounter" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nextReceiptNo" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PaymentReceiptCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credit" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "payerId" UUID,
    "source" "CreditSource" NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "adjustmentId" UUID,
    "paymentId" UUID,
    "reason" TEXT,
    "expiresAt" DATE,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundConsumption" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "refundId" UUID NOT NULL,
    "creditId" UUID NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionsCase" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "status" "CollectionsCaseStatus" NOT NULL DEFAULT 'OPEN',
    "lawyerRef" TEXT,
    "notes" TEXT,
    "openedById" UUID,
    "openedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CollectionsCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromiseToPay" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "promiseBy" DATE NOT NULL,
    "kept" BOOLEAN,
    "note" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromiseToPay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DunningEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "type" "DunningEventType" NOT NULL,
    "channels" "ReminderChannel"[],
    "outstanding" DECIMAL(12,3),
    "dueThisMonth" DECIMAL(12,3),
    "overdue" DECIMAL(12,3),
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "smsSentCount" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT,
    "actorId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DunningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payer_tenantId_idx" ON "Payer"("tenantId");

-- CreateIndex
CREATE INDEX "Payer_tenantId_parentId_idx" ON "Payer"("tenantId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFinancialAccount_studentId_key" ON "StudentFinancialAccount"("studentId");

-- CreateIndex
CREATE INDEX "StudentFinancialAccount_tenantId_idx" ON "StudentFinancialAccount"("tenantId");

-- CreateIndex
CREATE INDEX "StudentFinancialAccount_tenantId_payerId_idx" ON "StudentFinancialAccount"("tenantId", "payerId");

-- CreateIndex
CREATE INDEX "PaymentPlan_tenantId_chargeId_idx" ON "PaymentPlan"("tenantId", "chargeId");

-- CreateIndex
CREATE INDEX "PaymentPlan_tenantId_status_idx" ON "PaymentPlan"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Installment_tenantId_chargeId_idx" ON "Installment"("tenantId", "chargeId");

-- CreateIndex
CREATE INDEX "Installment_tenantId_planId_idx" ON "Installment"("tenantId", "planId");

-- CreateIndex
CREATE INDEX "Installment_tenantId_dueDate_idx" ON "Installment"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "Installment_tenantId_status_idx" ON "Installment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Payment_tenantId_accountId_idx" ON "Payment"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_studentId_idx" ON "Payment"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_status_idx" ON "Payment"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_tenantId_receiptNo_key" ON "Payment"("tenantId", "receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReceiptCounter_tenantId_key" ON "PaymentReceiptCounter"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Credit_adjustmentId_key" ON "Credit"("adjustmentId");

-- CreateIndex
CREATE INDEX "Credit_tenantId_accountId_idx" ON "Credit"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "Credit_tenantId_payerId_idx" ON "Credit"("tenantId", "payerId");

-- CreateIndex
CREATE INDEX "RefundConsumption_tenantId_refundId_idx" ON "RefundConsumption"("tenantId", "refundId");

-- CreateIndex
CREATE INDEX "RefundConsumption_tenantId_creditId_idx" ON "RefundConsumption"("tenantId", "creditId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionsCase_accountId_key" ON "CollectionsCase"("accountId");

-- CreateIndex
CREATE INDEX "CollectionsCase_tenantId_status_idx" ON "CollectionsCase"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PromiseToPay_tenantId_caseId_idx" ON "PromiseToPay"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "DunningEvent_tenantId_caseId_idx" ON "DunningEvent"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "DunningEvent_tenantId_createdAt_idx" ON "DunningEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Charge_tenantId_accountId_idx" ON "Charge"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "Charge_tenantId_academicYearId_idx" ON "Charge"("tenantId", "academicYearId");

-- CreateIndex
CREATE INDEX "Charge_tenantId_feeItemId_idx" ON "Charge"("tenantId", "feeItemId");

-- CreateIndex
CREATE INDEX "FeeAdjustment_tenantId_accountId_idx" ON "FeeAdjustment"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_tenantId_paymentId_idx" ON "PaymentAllocation"("tenantId", "paymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_tenantId_installmentId_idx" ON "PaymentAllocation"("tenantId", "installmentId");

-- CreateIndex
CREATE INDEX "Refund_tenantId_accountId_idx" ON "Refund"("tenantId", "accountId");

-- AddForeignKey
ALTER TABLE "Payer" ADD CONSTRAINT "Payer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payer" ADD CONSTRAINT "Payer_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFinancialAccount" ADD CONSTRAINT "StudentFinancialAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFinancialAccount" ADD CONSTRAINT "StudentFinancialAccount_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFinancialAccount" ADD CONSTRAINT "StudentFinancialAccount_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "StudentFinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_feeItemId_fkey" FOREIGN KEY ("feeItemId") REFERENCES "FeeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PaymentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "StudentFinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReceiptCounter" ADD CONSTRAINT "PaymentReceiptCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceDocument" ADD CONSTRAINT "EInvoiceDocument_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAdjustment" ADD CONSTRAINT "FeeAdjustment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "StudentFinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "StudentFinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "FeeAdjustment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "StudentFinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundConsumption" ADD CONSTRAINT "RefundConsumption_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundConsumption" ADD CONSTRAINT "RefundConsumption_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundConsumption" ADD CONSTRAINT "RefundConsumption_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionsCase" ADD CONSTRAINT "CollectionsCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionsCase" ADD CONSTRAINT "CollectionsCase_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "StudentFinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromiseToPay" ADD CONSTRAINT "PromiseToPay_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromiseToPay" ADD CONSTRAINT "PromiseToPay_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CollectionsCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DunningEvent" ADD CONSTRAINT "DunningEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DunningEvent" ADD CONSTRAINT "DunningEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CollectionsCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================================
-- Finance AR domain — invariants + Row-Level Security (Finance Domain Spec v1.0)
-- ============================================================================

-- BR-11 / ADR-001: at most one ACTIVE PaymentPlan per Charge (history retained as
-- SUPERSEDED/COMPLETED/CANCELLED rows). Enforced as a partial unique index.
CREATE UNIQUE INDEX "PaymentPlan_active_per_charge"
  ON "PaymentPlan"("chargeId")
  WHERE status = 'ACTIVE';

-- DB-1 / MT-2: fail-closed, FORCEd RLS on every new tenant-scoped finance table,
-- reusing the app_current_tenant()/app_is_platform() helpers.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'Payer', 'StudentFinancialAccount', 'PaymentPlan', 'Installment',
    'Payment', 'PaymentReceiptCounter', 'Credit', 'RefundConsumption',
    'CollectionsCase', 'PromiseToPay', 'DunningEvent'
  ];
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
    -- Runtime role privileges are granted centrally by infra/postgres/app-role.sql
    -- (GRANT ... ON ALL TABLES) which runs after migrations, mirroring every other
    -- table in the schema. Granting here would fail: munaxa_app does not yet exist
    -- when migrations run (CI/compose create it post-migrate).
  END LOOP;
END $$;

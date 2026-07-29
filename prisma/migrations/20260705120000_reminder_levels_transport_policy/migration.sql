-- Reminder levels + transport policy expansion (all additive, nullable — no backfill).

-- CreateEnum
CREATE TYPE "ReminderLevel" AS ENUM ('FRIENDLY', 'OVERDUE', 'FINAL', 'TRANSPORT_WARNING', 'SUSPENSION_NOTICE');

-- AlterTable: reminder escalation level on the dunning log
ALTER TABLE "DunningEvent" ADD COLUMN "level" "ReminderLevel";

-- AlterTable: alternative transport-suspension thresholds
ALTER TABLE "BillingPolicy"
  ADD COLUMN "suspendTransportAfterDays" INTEGER,
  ADD COLUMN "suspendTransportAfterAmount" DECIMAL(12,3);

-- AlterTable: suspension reason / by / reinstated-at
ALTER TABLE "StudentBillingProfile"
  ADD COLUMN "transportSuspendedReason" TEXT,
  ADD COLUMN "transportSuspendedById" UUID,
  ADD COLUMN "transportReinstatedAt" TIMESTAMPTZ(6);

-- Communication Log (additive): a medium enum + a COMMUNICATION dunning-event type.
-- Nullable column, no backfill — reuses the existing DunningEvent append-only log.

-- AlterEnum
ALTER TYPE "DunningEventType" ADD VALUE IF NOT EXISTS 'COMMUNICATION';

-- CreateEnum
CREATE TYPE "CommunicationMedium" AS ENUM ('PHONE', 'WHATSAPP', 'SMS', 'EMAIL', 'MEETING', 'NOTE');

-- AlterTable
ALTER TABLE "DunningEvent" ADD COLUMN "medium" "CommunicationMedium";

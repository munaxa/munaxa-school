-- AlterTable
ALTER TABLE "EInvoiceSettings" ADD COLUMN     "autoCreditOnAdjustment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoIssueOnCharge" BOOLEAN NOT NULL DEFAULT false;


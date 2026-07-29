-- ============================================================================
-- FinanceReceiptCounter — tenant isolation (RLS)
--   The 20260626120000_finance_receipt_number migration created the
--   FinanceReceiptCounter table but (unlike every other tenant-scoped table,
--   e.g. EInvoiceCounter / DocumentSequence) never enabled Row Level Security,
--   leaving the per-tenant receipt counter exposed to the anon/authenticated
--   roles. This migration closes that gap using the standard policy that keys
--   off app_current_tenant()/app_is_platform().
-- Backward compatible: same policy shape as the rest of the schema.
-- ============================================================================

ALTER TABLE "FinanceReceiptCounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinanceReceiptCounter" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "FinanceReceiptCounter";
CREATE POLICY tenant_isolation ON "FinanceReceiptCounter"
  USING ("tenantId" = app_current_tenant() OR app_is_platform())
  WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform());

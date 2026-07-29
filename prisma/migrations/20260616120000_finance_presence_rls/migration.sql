-- ============================================================================
-- Munaxa — Close the RLS coverage gap (finance/e-invoicing + presence/transport)
--
-- The original tenant-RLS migration (20260603120100_tenant_rls) and its successors
-- enabled Row-Level Security table-by-table. The following tenant-scoped tables were
-- never brought under a policy, so the documented "layer 4" database backstop did NOT
-- apply to them — a missing application-layer tenant filter on any of these would leak
-- or cross-write data between schools. They are the most sensitive gap: financial
-- records and student presence/location.
--
-- All runtime access to these tables already goes through `withTenant` (sets
-- app.tenant_id) or `withPlatform` (sets app.is_platform = 'on'), so this policy is
-- additive and fail-closed: with no tenant/platform context, no rows are visible or
-- writable.
--
-- Requires (already true in this deployment): the API connects as a NON-superuser,
-- NOBYPASSRLS role; FORCE ROW LEVEL SECURITY makes the policy apply to the table owner too.
-- ============================================================================

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    -- Finance / e-invoicing
    'EInvoiceSettings', 'EInvoiceCredential', 'EInvoiceCounter',
    'EInvoiceDocument', 'EInvoiceLog',
    'FeeAdjustment', 'PaymentAllocation', 'PaymentReminder', 'Refund',
    'StudentBillingProfile',
    -- Presence / transport
    'AttendanceSourceConfig', 'StudentPresenceEvent', 'BusAttendanceEvent'
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
  END LOOP;
END $$;

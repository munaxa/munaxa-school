-- ============================================================================
-- Munaxa — Tenant isolation via PostgreSQL Row-Level Security (RLS)
--
-- This is the DB-level backstop (layer 4) of the multi-tenant isolation strategy.
-- Even if an application-layer bug omits a tenant filter, Postgres will not return
-- or accept rows belonging to another tenant.
--
-- How it works at runtime:
--   The application opens a transaction and runs, per request:
--       SET LOCAL app.tenant_id  = '<tenant-uuid>';   -- school sessions
--   or, for cross-tenant platform operations:
--       SET LOCAL app.is_platform = 'on';             -- platform sessions
--
--   current_setting(..., true) returns NULL when unset, so policies FAIL CLOSED:
--   with no tenant context set, no tenant-scoped rows are visible or writable.
--
-- IMPORTANT (ops): the application MUST connect with a database role that is
-- NOT a superuser and does NOT have BYPASSRLS. FORCE ROW LEVEL SECURITY is set so
-- that policies apply even to the table owner.
-- ============================================================================

-- Helper functions -----------------------------------------------------------
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS uuid
  LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_is_platform() RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.is_platform', true), 'off') = 'on'
$$;

-- Strictly tenant-scoped tables (non-null tenantId): uniform policy ----------
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'School', 'Campus', 'AcademicYear', 'Semester', 'Grade',
    'Classroom', 'Section', 'User', 'UserRole'
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

-- Role: tenant-scoped rows plus global (null-tenant) platform rows -----------
ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Role";
CREATE POLICY tenant_isolation ON "Role"
  USING (
    "tenantId" = app_current_tenant()
    OR "tenantId" IS NULL            -- global/platform roles are readable
    OR app_is_platform()
  )
  WITH CHECK (
    "tenantId" = app_current_tenant()
    OR app_is_platform()             -- only platform sessions may write global roles
  );

-- AuditLog: tenant-scoped plus platform-level (null-tenant) events -----------
-- Append-only: SELECT/INSERT permitted under tenant scope; UPDATE/DELETE denied
-- to everyone (no permissive policy for those commands => blocked under FORCE RLS).
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_select ON "AuditLog";
CREATE POLICY audit_select ON "AuditLog"
  FOR SELECT
  USING (
    "tenantId" = app_current_tenant()
    OR (("tenantId" IS NULL) AND app_is_platform())
    OR app_is_platform()
  );
DROP POLICY IF EXISTS audit_insert ON "AuditLog";
CREATE POLICY audit_insert ON "AuditLog"
  FOR INSERT
  WITH CHECK (
    "tenantId" = app_current_tenant()
    OR app_is_platform()
  );

-- ============================================================================
-- Munaxa — Close the remaining Supabase security-advisor findings
--
-- Supabase's database linter (PostgREST exposure) flagged:
--   ERROR rls_disabled_in_public : Tenant, RolePermission, Permission, _prisma_migrations
--   WARN  function_search_path_mutable : app_current_tenant, app_is_platform
--
-- This migration brings the last tables under the existing RLS backstop and pins a
-- safe search_path on the two helper functions. It is additive and fail-closed,
-- consistent with 20260603120100_tenant_rls and 20260616120000_finance_presence_rls.
--
-- Preconditions (already true in this deployment): the API connects as a
-- non-superuser, NOBYPASSRLS role; FORCE ROW LEVEL SECURITY makes policies apply
-- to the table owner too.
-- ============================================================================

-- 1) Tenant — root of the tenant tree; its own id IS the tenant id (no tenantId
--    column). A tenant session may read ONLY its own row; all writes (provisioning)
--    run through withPlatform, so only platform sessions may insert/update/delete.
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Tenant";
CREATE POLICY tenant_isolation ON "Tenant"
  USING ("id" = app_current_tenant() OR app_is_platform())
  WITH CHECK (app_is_platform());

-- 2) Permission — global catalog (not tenant-scoped). Readable by any session
--    (runtime resolves authz from it); writable only by platform (seed/provisioning).
ALTER TABLE "Permission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Permission" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS permission_read  ON "Permission";
DROP POLICY IF EXISTS permission_write ON "Permission";
CREATE POLICY permission_read  ON "Permission" FOR SELECT USING (true);
CREATE POLICY permission_write ON "Permission"
  FOR ALL USING (app_is_platform()) WITH CHECK (app_is_platform());

-- 3) RolePermission — no tenantId of its own; scope is inherited from the parent
--    Role. Mirrors the Role policy: read own + global (null-tenant) roles, write
--    own + platform.
ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RolePermission" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RolePermission";
CREATE POLICY tenant_isolation ON "RolePermission"
  USING (EXISTS (
    SELECT 1 FROM "Role" r
    WHERE r.id = "roleId"
      AND (r."tenantId" = app_current_tenant() OR r."tenantId" IS NULL OR app_is_platform())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Role" r
    WHERE r.id = "roleId"
      AND (r."tenantId" = app_current_tenant() OR app_is_platform())
  ));

-- 4) _prisma_migrations — Prisma's internal bookkeeping table; not part of the app.
--    Enable RLS (no policy) to deny PostgREST anon/authenticated. Deliberately NOT
--    FORCEd: `prisma migrate deploy` runs as the table owner, which bypasses
--    non-forced RLS, so migrations keep working.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- 5) Pin a safe, immutable search_path on the helper functions (advisor WARN).
--    Both reference only pg_catalog builtins (current_setting, NULLIF, COALESCE, ::uuid),
--    so an empty search_path is safe and removes the role-mutable-search_path risk.
ALTER FUNCTION app_current_tenant() SET search_path = '';
ALTER FUNCTION app_is_platform()    SET search_path = '';

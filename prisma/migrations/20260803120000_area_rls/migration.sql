-- ============================================================================
-- Munaxa — tenant isolation (RLS) for Area
--
-- Area shipped in 20260624120000_area_student_transport without the RLS block
-- that every other tenant-scoped module applies, so it was the only table in
-- the schema left unprotected. It carries a non-null tenantId and therefore
-- takes the standard uniform policy: rows are visible and writable only from
-- their own tenant's context, or from a platform session.
--
-- This is a live gap, not hardening. Two lookups fetch an Area by id with no
-- tenant filter — area.repository.ts (findById) and student.repository.ts
-- (validating an areaId before assigning it to a student). On every other
-- table RLS is the backstop that makes such a query safe; here there was none,
-- so one tenant could read another tenant's Area by id and attach a student to
-- it. Enabling the policy closes that without touching the call sites, which is
-- exactly the "layer 4" role described in 20260603120100_tenant_rls.
-- ============================================================================

ALTER TABLE "Area" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Area" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Area";
CREATE POLICY tenant_isolation ON "Area"
  USING ("tenantId" = app_current_tenant() OR app_is_platform())
  WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform());

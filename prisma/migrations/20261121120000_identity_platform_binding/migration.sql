-- ============================================================================
-- Munaxa Identity: which organisation's access tokens may act in which school (SC-07).
--
-- With PLATFORM_AUTH_* configured the API accepts ES256 access tokens issued by Munaxa Identity.
-- A token names its organisation in `tid` and the grants in `perms` were computed in that
-- organisation, so `tid` must never choose a school by itself. Each school is bound to exactly one
-- (issuer, organisation), and a token resolves only to a School account in the school bound to its
-- organisation: the organisation is a filter on a stored relationship, the same rule Munaxa Work
-- applies (munaxa-work ADR-0080). A school with no binding resolves nobody.
--
-- `User.platformSubject` is the Identity `sub` an account signs in as, unique per school.
-- Additive: no existing row changes, and local sign-in is unaffected.
-- ============================================================================

ALTER TABLE "User" ADD COLUMN "platformSubject" VARCHAR(255);
CREATE UNIQUE INDEX "User_tenantId_platformSubject_key" ON "User"("tenantId", "platformSubject");

CREATE TABLE "TenantPlatformBinding" (
  "id"               UUID           NOT NULL,
  "tenantId"         UUID           NOT NULL,
  "platformIssuer"   VARCHAR(2048)  NOT NULL,
  "platformTenantId" VARCHAR(255)   NOT NULL,
  "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy"        VARCHAR(255)   NOT NULL,
  "deletedAt"        TIMESTAMPTZ(6),
  CONSTRAINT "TenantPlatformBinding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantPlatformBinding_issuer_present" CHECK (btrim("platformIssuer") <> ''),
  CONSTRAINT "TenantPlatformBinding_organisation_present" CHECK (btrim("platformTenantId") <> '')
);

-- One organisation per school, and one school per organisation. The second is the one that
-- matters: an organisation bound to two schools would carry its grants into both. Plain unique
-- indexes, so even a retired (soft-deleted) binding cannot be duplicated around.
CREATE UNIQUE INDEX "TenantPlatformBinding_tenantId_key"
  ON "TenantPlatformBinding"("tenantId");
CREATE UNIQUE INDEX "TenantPlatformBinding_platformIssuer_platformTenantId_key"
  ON "TenantPlatformBinding"("platformIssuer", "platformTenantId");

ALTER TABLE "TenantPlatformBinding"
  ADD CONSTRAINT "TenantPlatformBinding_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Isolated like every tenant table: a school sees its own binding; the platform plane sees all
-- (that is how the request path resolves a token before any school is in context).
DO $$
BEGIN
  EXECUTE 'ALTER TABLE "TenantPlatformBinding" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "TenantPlatformBinding" FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON "TenantPlatformBinding"';
  EXECUTE $f$
    CREATE POLICY tenant_isolation ON "TenantPlatformBinding"
      USING ("tenantId" = app_current_tenant() OR app_is_platform())
      WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform())
  $f$;
END $$;

-- The runtime role reads bindings and never writes them: a runtime that could rebind its own
-- school could admit another organisation's tokens. infra/postgres/app-role.sql and
-- runtime-grants.sql repeat this after their blanket grants, so a re-run does not undo it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'munaxa_app') THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE "TenantPlatformBinding" FROM munaxa_app';
  END IF;
END $$;

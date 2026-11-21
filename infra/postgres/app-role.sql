-- ============================================================================
-- Munaxa — application database role (NON-superuser, NOBYPASSRLS)
--
-- The Munaxa API connects at runtime as this restricted role so that PostgreSQL
-- Row-Level Security is actually enforced (superusers and BYPASSRLS roles skip RLS).
-- Migrations run separately as the privileged schema owner (DIRECT_DATABASE_URL).
--
-- Used by:
--   - docker-compose (mounted into /docker-entrypoint-initdb.d, runs at first init)
--   - CI (executed after `prisma migrate deploy`)
--
-- This password is for local/CI only. Production credentials come from a secrets
-- manager and are NEVER committed.
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'munaxa_app') THEN
    CREATE ROLE munaxa_app WITH LOGIN PASSWORD 'munaxa_app_dev'
      NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO munaxa_app;

-- Privileges on already-existing objects (CI runs this after migrations).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO munaxa_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO munaxa_app;

-- Default privileges for objects created later by the owner (compose runs this
-- before migrations, so future migration tables are covered automatically).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO munaxa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO munaxa_app;

-- Identity bindings (SC-07) are written by the owner only: a runtime that could rebind its own
-- school could admit another organisation's tokens. Repeated after the blanket grant above so a
-- re-run never undoes it. Skipped when the table does not exist yet (compose runs this first).
DO $$ BEGIN
  IF to_regclass('public."TenantPlatformBinding"') IS NOT NULL THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE "TenantPlatformBinding" FROM munaxa_app;
  END IF;
END $$;

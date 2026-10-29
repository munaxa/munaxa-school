-- The runtime role's grants on the shared AWS stack, applied by the migrate job after
-- `prisma migrate deploy`, as the schema owner that ran the migrations.
--
-- The same grants as app-role.sql without its role creation: on AWS, munaxa_app is created by the
-- stack's db-admin task (NOSUPERUSER, NOBYPASSRLS, its password from the secret bundle), never with
-- a password in a file. Row-level security therefore applies to every query it makes.
GRANT USAGE ON SCHEMA public TO munaxa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO munaxa_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO munaxa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO munaxa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO munaxa_app;
-- Prisma's own bookkeeping is the owner's alone.
REVOKE ALL ON TABLE _prisma_migrations FROM munaxa_app;

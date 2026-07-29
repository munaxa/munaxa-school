-- Relax Role.key from the RoleKey enum to free text so tenants can define custom roles.
-- Existing values (e.g. 'Teacher', 'SchoolAdmin') are preserved as text. Backward compatible:
-- system roles keep their RoleKey-derived keys; custom roles get generated slugs.
ALTER TABLE "Role" ALTER COLUMN "key" TYPE TEXT USING "key"::text;

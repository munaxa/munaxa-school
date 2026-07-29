/*
 * Fan-out migrations across siloed tenant databases (hybrid tenant-DB routing).
 *
 * The shared/control-plane DB is migrated as usual (`prisma migrate deploy` with the normal
 * DATABASE_URL/DIRECT_DATABASE_URL). This script additionally applies the SAME migrations to every
 * tenant that has been promoted to its own database.
 *
 * Input: TENANT_DATABASE_DIRECT_OVERRIDES — JSON `{ "<tenantId>": "<owner connection url>" }`
 *        (the schema-owner URL used for DDL; the runtime app-role URL is TENANT_DATABASE_OVERRIDES).
 * For each distinct owner URL it runs `prisma migrate deploy`, then re-applies app-role.sql so the
 * NOBYPASSRLS runtime role is granted on any new tables. Idempotent; safe to re-run.
 *
 * Usage: node scripts/migrate-tenants.cjs   (run after the shared `prisma migrate deploy`)
 */
const { execSync } = require('node:child_process');
const path = require('node:path');

const raw = process.env.TENANT_DATABASE_DIRECT_OVERRIDES;
if (!raw || !raw.trim()) {
  console.log('No siloed tenant databases configured (TENANT_DATABASE_DIRECT_OVERRIDES unset).');
  process.exit(0);
}

let registry;
try {
  registry = JSON.parse(raw);
} catch {
  console.error('TENANT_DATABASE_DIRECT_OVERRIDES is not valid JSON.');
  process.exit(1);
}

const schemaPath = path.resolve(__dirname, '../../../prisma/schema.prisma');
const appRoleSql = path.resolve(__dirname, '../../../infra/postgres/app-role.sql');
const byUrl = new Map(); // url -> [tenantIds] (dedupe shared DB servers)
for (const [tenantId, url] of Object.entries(registry)) {
  if (typeof url === 'string' && url) byUrl.set(url, [...(byUrl.get(url) ?? []), tenantId]);
}

let failures = 0;
for (const [url, tenantIds] of byUrl) {
  const label = tenantIds.join(', ');
  console.log(`\n→ Migrating siloed database for tenant(s) ${label}`);
  const env = { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url };
  try {
    execSync(`./node_modules/.bin/prisma migrate deploy --schema=${schemaPath}`, {
      stdio: 'inherit',
      env,
    });
    // Re-grant the restricted runtime role on any new tables.
    execSync(`psql "${url}" -v ON_ERROR_STOP=1 -f "${appRoleSql}"`, { stdio: 'inherit', env });
    console.log(`✔ ${label} migrated`);
  } catch (e) {
    failures += 1;
    console.error(`✖ ${label} failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} siloed database(s) failed to migrate.`);
  process.exit(1);
}
console.log('\nAll siloed tenant databases migrated.');

/*
 * Promote one tenant (school) onto its own database — the same-server data move that turns the
 * wizard's DATA_COPIED/VERIFIED steps from a manual gate into one command.
 *
 * It (optionally) creates the target database, applies the schema + RLS app role, then copies the
 * tenant's rows from the shared database into the target in FK-safe order and verifies row counts.
 * Idempotent (createMany skipDuplicates); aborts non-zero on any count mismatch. Run in a
 * maintenance window for that one school; afterwards register its URL in TENANT_DATABASE_OVERRIDES
 * and (once verified) delete the rows from the shared DB.
 *
 * Required env:
 *   TENANT_ID            the tenant to move
 *   DIRECT_DATABASE_URL  source (shared) owner URL            (read)
 *   TARGET_DIRECT_URL    target owner URL                     (DDL + write)
 * Optional:
 *   CREATE_TARGET=1      CREATE DATABASE on the target server first
 *
 * Usage: TENANT_ID=… TARGET_DIRECT_URL=… [CREATE_TARGET=1] node scripts/promote-tenant.cjs
 */
const { execSync } = require('node:child_process');
const path = require('node:path');
const { PrismaClient, Prisma } = require('@prisma/client');

const TENANT_ID = req('TENANT_ID');
const SOURCE_URL = req('DIRECT_DATABASE_URL');
const TARGET_URL = req('TARGET_DIRECT_URL');
const schemaPath = path.resolve(__dirname, '../../../prisma/schema.prisma');
const appRoleSql = path.resolve(__dirname, '../../../infra/postgres/app-role.sql');

function req(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env ${name}`);
    process.exit(1);
  }
  return v;
}

/** Run fn inside a transaction with the platform RLS context set (FORCE RLS applies to the owner). */
function platform(client, fn) {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.is_platform', 'on', true)`;
    return fn(tx);
  });
}

const delegate = (model) => model.charAt(0).toLowerCase() + model.slice(1);

/** FK-safe insertion order: a model's parents (the models it holds FKs to) come first. */
function topoOrder(models) {
  const byName = new Map(models.map((m) => [m.name, m]));
  const visited = new Set();
  const order = [];
  const visit = (name) => {
    if (visited.has(name)) return;
    visited.add(name);
    const m = byName.get(name);
    for (const f of m.fields) {
      if (f.relationFromFields && f.relationFromFields.length > 0 && byName.has(f.type)) {
        visit(f.type); // parent first
      }
    }
    order.push(name);
  };
  for (const m of models) visit(m.name);
  return order;
}

function whereFor(model, roleIds) {
  if (model === 'Tenant') return { id: TENANT_ID };
  if (model === 'Permission') return {}; // global catalog — copy whole so ids align
  if (model === 'RolePermission') return { roleId: { in: roleIds } };
  return { tenantId: TENANT_ID };
}

async function main() {
  if (process.env.CREATE_TARGET === '1') {
    const u = new URL(TARGET_URL);
    const dbName = u.pathname.replace(/^\//, '').split('?')[0];
    const adminUrl = new URL(TARGET_URL);
    adminUrl.pathname = '/postgres';
    console.log(`→ Creating database ${dbName}`);
    try {
      execSync(`psql "${adminUrl.toString()}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \\"${dbName}\\""`, {
        stdio: 'inherit',
      });
    } catch {
      console.log('  (database may already exist — continuing)');
    }
  }

  console.log('→ Applying schema + RLS app role to the target');
  execSync(`./node_modules/.bin/prisma migrate deploy --schema=${schemaPath}`, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TARGET_URL, DIRECT_DATABASE_URL: TARGET_URL },
  });
  execSync(`psql "${TARGET_URL}" -v ON_ERROR_STOP=1 -f "${appRoleSql}"`, { stdio: 'inherit' });

  const source = new PrismaClient({ datasources: { db: { url: SOURCE_URL } } });
  const target = new PrismaClient({ datasources: { db: { url: TARGET_URL } } });
  try {
    const models = Prisma.dmmf.datamodel.models;
    const order = topoOrder(models);

    // The tenant's role ids (needed to scope the RolePermission join, which has no tenantId).
    const roleIds = (
      await platform(source, (tx) => tx.role.findMany({ where: { tenantId: TENANT_ID }, select: { id: true } }))
    ).map((r) => r.id);

    const summary = [];
    for (const name of order) {
      const where = whereFor(name, roleIds);
      const rows = await platform(source, (tx) => tx[delegate(name)].findMany({ where }));
      if (rows.length > 0) {
        await platform(target, (tx) => tx[delegate(name)].createMany({ data: rows, skipDuplicates: true }));
      }
      summary.push({ model: name, copied: rows.length });
    }

    // Verify: counts on the target match the source for this tenant.
    console.log('\n→ Verifying row counts');
    let mismatches = 0;
    for (const { model } of summary) {
      const where = whereFor(model, roleIds);
      const [src, tgt] = await Promise.all([
        platform(source, (tx) => tx[delegate(model)].count({ where })),
        platform(target, (tx) => tx[delegate(model)].count({ where })),
      ]);
      const ok = src === tgt;
      if (!ok) mismatches += 1;
      if (src > 0 || !ok) console.log(`  ${ok ? '✔' : '✖'} ${model}: source=${src} target=${tgt}`);
    }

    if (mismatches > 0) {
      console.error(`\n${mismatches} table(s) did not match. Investigate before activating.`);
      process.exit(1);
    }
    console.log(`\n✔ Tenant ${TENANT_ID} copied and verified into its own database.`);
    console.log('Next: add the target URL to TENANT_DATABASE_OVERRIDES (secrets), redeploy, smoke-test,');
    console.log('then remove this tenant\'s rows from the shared database.');
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

main().catch((e) => {
  console.error('PROMOTE FAILED:', e);
  process.exit(1);
});

/*
 * Bind a school (tenant) to its Munaxa Identity organisation, and optionally link one School account
 * to the Identity account that signs in as it (SC-07). Provisioning, not authorization.
 *
 * What it writes, in one transaction under the platform RLS context:
 *   - TenantPlatformBinding (tenant ↔ issuer + organisation id). Once written it is never changed
 *     here: a different organisation for a bound school, or an organisation already bound to
 *     another school, is refused. Re-running with the same values reports and writes nothing.
 *   - With --link-email and --platform-user-id: User.platformSubject on the School account with
 *     that email in that school. An account already linked to a different subject is refused.
 *   - An AuditLog row for each write.
 *
 * What it does not do: create an Identity account, an organisation, a role, a password, a token or
 * a grant. Identity owns those (docs/security/identity-integration.md, "Identity side").
 *
 * The runtime role cannot write bindings (infra/postgres/app-role.sql), so run it as the schema
 * owner. FORCE ROW LEVEL SECURITY applies to the owner too; the platform context is set explicitly.
 *
 * Required env:
 *   DIRECT_DATABASE_URL   owner connection (DATABASE_MIGRATION_URL is also accepted)
 * Flags:
 *   --tenant-slug <slug> | --tenant-id <uuid>   the school
 *   --platform-tenant-id <id>                    Identity organisation id (the token's `tid`)
 *   --platform-issuer <url>                      exactly PLATFORM_AUTH_ISSUER (defaults to it)
 *   --link-email <email> --platform-user-id <id> optional: link one account (the token's `sub`)
 *   --allow-production                           required when NODE_ENV=production
 *
 * Usage:
 *   DIRECT_DATABASE_URL=… node scripts/bind-identity-organisation.cjs --tenant-slug demo \
 *     --platform-tenant-id <org id> --platform-issuer https://identity.example \
 *     [--link-email admin@school.example --platform-user-id <sub>]
 */
const { PrismaClient } = require('@prisma/client');

const ACTOR = 'system:bind-identity-organisation';

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const connection = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_MIGRATION_URL;
const tenantSlug = argument('tenant-slug');
const tenantId = argument('tenant-id');
const organisation = (argument('platform-tenant-id') ?? '').trim();
const issuer = (argument('platform-issuer') ?? process.env.PLATFORM_AUTH_ISSUER ?? '').trim();
const linkEmail = argument('link-email');
const subject = argument('platform-user-id');

if (!connection) fail('Set DIRECT_DATABASE_URL to the schema owner connection.');
if (!tenantSlug === !tenantId) fail('Give exactly one of --tenant-slug or --tenant-id.');
if (organisation === '')
  fail('Give --platform-tenant-id: the Identity organisation id (token `tid`).');
if (issuer === '') fail('Give --platform-issuer, or set PLATFORM_AUTH_ISSUER.');
try {
  new URL(issuer);
} catch {
  fail(`--platform-issuer "${issuer}" is not a URL; it must equal PLATFORM_AUTH_ISSUER exactly.`);
}
if (Boolean(linkEmail) !== Boolean(subject)) {
  fail('--link-email and --platform-user-id go together.');
}
if (process.env.NODE_ENV === 'production' && !process.argv.includes('--allow-production')) {
  fail(
    'NODE_ENV=production: binding a school to an organisation grants reach; add --allow-production.',
  );
}

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: connection });
  try {
    const report = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_platform', 'on', true)`;
      const tenant = await tx.tenant.findFirst({
        where: tenantId ? { id: tenantId } : { slug: tenantSlug },
        select: { id: true, slug: true },
      });
      if (!tenant) throw new Error(`No school ${tenantId ?? tenantSlug}.`);

      const lines = [];
      const existing = await tx.tenantPlatformBinding.findUnique({
        where: { tenantId: tenant.id },
      });
      if (existing) {
        if (existing.deletedAt)
          throw new Error(`School ${tenant.slug} has a retired binding; not re-binding it.`);
        if (existing.platformIssuer !== issuer || existing.platformTenantId !== organisation) {
          throw new Error(
            `School ${tenant.slug} is already bound to ${existing.platformTenantId} at ${existing.platformIssuer}; a binding is never changed here.`,
          );
        }
        lines.push(`School ${tenant.slug} is already bound to ${organisation}; nothing written.`);
      } else {
        const taken = await tx.tenantPlatformBinding.findFirst({
          where: { platformIssuer: issuer, platformTenantId: organisation },
          select: { tenantId: true },
        });
        if (taken)
          throw new Error(`Organisation ${organisation} is already bound to another school.`);
        await tx.tenantPlatformBinding.create({
          data: {
            tenantId: tenant.id,
            platformIssuer: issuer,
            platformTenantId: organisation,
            createdBy: ACTOR,
          },
        });
        await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            action: 'identity.binding.create',
            entityType: 'TenantPlatformBinding',
            metadata: { platformIssuer: issuer, platformTenantId: organisation, actor: ACTOR },
          },
        });
        lines.push(
          `Bound school ${tenant.slug} (${tenant.id}) to organisation ${organisation} at ${issuer}.`,
        );
      }

      if (linkEmail) {
        const user = await tx.user.findFirst({
          where: { tenantId: tenant.id, email: linkEmail, deletedAt: null },
          select: { id: true, platformSubject: true },
        });
        if (!user) throw new Error(`No account ${linkEmail} in school ${tenant.slug}.`);
        if (user.platformSubject && user.platformSubject !== subject) {
          throw new Error(
            `Account ${linkEmail} is already linked to another Identity account; not relinking.`,
          );
        }
        if (user.platformSubject === subject) {
          lines.push(`Account ${linkEmail} is already linked; nothing written.`);
        } else {
          await tx.user.update({ where: { id: user.id }, data: { platformSubject: subject } });
          await tx.auditLog.create({
            data: {
              tenantId: tenant.id,
              action: 'identity.account.link',
              entityType: 'User',
              entityId: user.id,
              metadata: { platformSubject: subject, actor: ACTOR },
            },
          });
          lines.push(`Linked account ${linkEmail} to Identity subject ${subject}.`);
        }
      }
      return lines;
    });
    for (const line of report) console.log(line);
    console.log(
      'A binding grants nothing by itself: assign the account an Identity role carrying school:* permissions (docs/security/identity-integration.md).',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));

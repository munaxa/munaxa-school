/**
 * Add a school and its first administrator. A Munaxa operator runs this once per new school; the
 * school's licence, plan and subscription live in Munaxa Control, not here.
 *
 * The administrator has no School password: staff sign in with Munaxa (docs/security/
 * identity-sign-in.md). Their Identity account must use the same email address, checked in
 * Identity, with two-step verification on.
 *
 *   SCHOOL_SLUG=al-noor SCHOOL_NAME='Al Noor School' ADMIN_EMAIL=principal@al-noor.example \
 *   ADMIN_FIRST_NAME=Rana ADMIN_LAST_NAME=Haddad \
 *   pnpm --filter @school/api school:provision            # dry run: says what it would do
 *   ... APPLY=yes pnpm --filter @school/api school:provision # does it
 *
 * In the API image (a one-off task with the API's database settings): `node dist/ops/provision-school.js`.
 *
 * Input comes from the environment, never from arguments. Idempotent: running it again changes
 * nothing that already exists, and it never changes an existing user's roles or status.
 * Plain PrismaClient (no Nest DI), like the other scripts here.
 */
import { PrismaClient } from '@prisma/client';
import { ALL_PERMISSIONS, SCHOOL_ROLES, permissionsForRole } from '@school/domain';

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ProvisionInput {
  slug: string;
  name: string;
  adminEmail: string;
  adminFirstName?: string;
  adminLastName?: string;
}

export function readInput(env: NodeJS.ProcessEnv): ProvisionInput {
  const slug = (env['SCHOOL_SLUG'] ?? '').trim().toLowerCase();
  const name = (env['SCHOOL_NAME'] ?? '').trim();
  const adminEmail = (env['ADMIN_EMAIL'] ?? '').trim().toLowerCase();
  const problems: string[] = [];
  if (!SLUG.test(slug)) problems.push('SCHOOL_SLUG: lowercase letters, digits and "-", at most 64');
  if (name.length === 0 || name.length > 200) problems.push('SCHOOL_NAME: 1 to 200 characters');
  if (!EMAIL.test(adminEmail)) problems.push('ADMIN_EMAIL: an email address');
  if (problems.length > 0) throw new Error(problems.join('\n'));
  return {
    slug,
    name,
    adminEmail,
    adminFirstName: env['ADMIN_FIRST_NAME']?.trim() || undefined,
    adminLastName: env['ADMIN_LAST_NAME']?.trim() || undefined,
  };
}

export async function provisionSchool(
  prisma: PrismaClient,
  input: ProvisionInput,
  apply: boolean,
): Promise<string[]> {
  const done: string[] = [];
  await prisma.$transaction(
    async (tx) => {
      // Row-level security: the tenant, its roles and the global catalogue are written across
      // tenants, so this runs in the platform context, as every seed here does.
      await tx.$executeRaw`SELECT set_config('app.is_platform', 'on', true)`;

      for (const key of ALL_PERMISSIONS) {
        const category = key.split(':')[0] ?? 'general';
        if (apply) {
          await tx.permission.upsert({ where: { key }, update: {}, create: { key, category } });
        }
      }

      let tenant = await tx.tenant.findUnique({ where: { slug: input.slug } });
      if (tenant) {
        done.push(`school "${input.slug}" exists (${tenant.status}), left as it is`);
      } else {
        done.push(`create school "${input.slug}" (${input.name}), ACTIVE`);
        if (apply) {
          tenant = await tx.tenant.create({
            data: { name: input.name, slug: input.slug, status: 'ACTIVE' },
          });
        }
      }
      const tenantId = tenant?.id;

      for (const key of SCHOOL_ROLES) {
        const role = tenantId ? await tx.role.findFirst({ where: { tenantId, key } }) : null;
        if (role) continue;
        done.push(`create role ${key}`);
        if (!apply || !tenantId) continue;
        const created = await tx.role.create({
          data: { tenantId, key, scope: 'SCHOOL', isSystem: true },
        });
        const permissions = await tx.permission.findMany({
          where: { key: { in: permissionsForRole(key) } },
          select: { id: true },
        });
        if (permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: permissions.map((p) => ({ roleId: created.id, permissionId: p.id })),
            skipDuplicates: true,
          });
        }
      }

      const existing = tenantId
        ? await tx.user.findUnique({
            where: { tenantId_email: { tenantId, email: input.adminEmail } },
          })
        : null;
      if (existing) {
        done.push(`administrator ${input.adminEmail} exists, left as it is`);
        return;
      }
      done.push(`create administrator ${input.adminEmail} (SchoolAdmin, signs in with Munaxa)`);
      if (!apply || !tenantId) return;
      const admin = await tx.user.create({
        data: {
          tenantId,
          email: input.adminEmail,
          status: 'ACTIVE',
          // No School password: staff sign in with Munaxa only.
          passwordHash: null,
          mustChangePassword: false,
          firstNameEn: input.adminFirstName ?? null,
          lastNameEn: input.adminLastName ?? null,
        },
      });
      const adminRole = await tx.role.findFirstOrThrow({ where: { tenantId, key: 'SchoolAdmin' } });
      await tx.userRole.create({ data: { tenantId, userId: admin.id, roleId: adminRole.id } });
    },
    { maxWait: 60_000, timeout: 60_000 },
  );
  return done;
}

async function main(): Promise<void> {
  const input = readInput(process.env);
  const apply = process.env['APPLY'] === 'yes';
  const prisma = new PrismaClient();
  try {
    const done = await provisionSchool(prisma, input, apply);
    const lines = [
      apply ? 'Done:' : 'Dry run (APPLY=yes to do it):',
      ...done.map((l) => `  - ${l}`),
    ];
    process.stdout.write(`${lines.join('\n')}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

/**
 * Bootstrap a Platform Console (Munaxa employee) account you can log into.
 *
 * Plain PrismaClient + bcryptjs (no Nest DI — tsx doesn't emit the decorator metadata Nest needs),
 * mirroring prisma/seed.ts and scripts/seed-demo.ts. Idempotent.
 *
 * What it does (all under the platform RLS context):
 *   1. Seeds the global permission catalog (order-independent).
 *   2. Provisions the global Platform roles (tenantId = NULL) + their permission mappings.
 *   3. Ensures the reserved platform "home" tenant exists (owns platform user rows; never a school).
 *   4. Creates/updates the Platform Owner user with the given email + password.
 *   5. Links the Owner role.
 *
 * Run (after DATABASE_URL is set to a role allowed to write — i.e. a NON-RLS-bypassing app role
 * works because we set the platform context):
 *
 *   PLATFORM_OWNER_EMAIL=you@munaxa.com \
 *   PLATFORM_OWNER_PASSWORD='Str0ngPassw0rd!' \
 *   pnpm --filter @school/api db:seed:platform-owner
 *
 * Then sign in at the Admin Portal /login with that email + password (leave the school field blank).
 * The bcrypt hash verifies today and is transparently upgraded to scrypt on first login.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ALL_PERMISSIONS, PLATFORM_ROLES, PlatformRole, permissionsForRole } from '@school/domain';
import { PLATFORM_TENANT_ID, PLATFORM_TENANT_SLUG } from '../src/platform/platform.constants';

const EMAIL = (process.env.PLATFORM_OWNER_EMAIL ?? 'owner@munaxa.com').trim().toLowerCase();
const PASSWORD = process.env.PLATFORM_OWNER_PASSWORD ?? 'ChangeMe123!';
const FIRST_NAME = process.env.PLATFORM_OWNER_FIRST_NAME ?? 'Platform';
const LAST_NAME = process.env.PLATFORM_OWNER_LAST_NAME ?? 'Owner';
// Which platform role to grant (default: full-access Owner). Any PlatformRole key is accepted.
const ROLE_KEY = process.env.PLATFORM_OWNER_ROLE ?? PlatformRole.PlatformOwner;

const prisma = new PrismaClient();

/** Run fn with the platform RLS context set, so cross-tenant/global writes pass row-level security. */
function platform<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_platform', 'on', true)`;
      return fn(tx as unknown as PrismaClient);
    },
    { maxWait: 60_000, timeout: 60_000 },
  );
}

function assertStrong(password: string): void {
  const ok = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
  if (!ok) {
    throw new Error('PLATFORM_OWNER_PASSWORD must be ≥8 chars with an upper, a lower and a digit.');
  }
}

async function main(): Promise<void> {
  if (!PLATFORM_ROLES.includes(ROLE_KEY as (typeof PLATFORM_ROLES)[number])) {
    throw new Error(
      `PLATFORM_OWNER_ROLE must be one of: ${PLATFORM_ROLES.join(', ')} (got "${ROLE_KEY}")`,
    );
  }
  assertStrong(PASSWORD);
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // 1. Global permission catalog (idempotent; RLS-protected → platform context).
  await platform(async (tx) => {
    for (const key of ALL_PERMISSIONS) {
      const category = key.split(':')[0] ?? 'general';
      await tx.permission.upsert({
        where: { key },
        update: { category },
        create: { key, category },
      });
    }
  });

  // 2. Global Platform roles (tenantId = NULL) + their permission mappings.
  await platform(async (tx) => {
    for (const key of PLATFORM_ROLES) {
      const role =
        (await tx.role.findFirst({ where: { tenantId: null, key } })) ??
        (await tx.role.create({
          data: { tenantId: null, key, scope: 'PLATFORM', isSystem: true },
        }));
      const permissionKeys = permissionsForRole(key);
      const permissions = await tx.permission.findMany({
        where: { key: { in: permissionKeys } },
        select: { id: true },
      });
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
          skipDuplicates: true,
        });
      }
    }
  });

  // 3–5. Reserved home tenant + the Platform Owner user + role link.
  await platform(async (tx) => {
    await tx.tenant.upsert({
      where: { id: PLATFORM_TENANT_ID },
      create: {
        id: PLATFORM_TENANT_ID,
        name: 'Munaxa Platform',
        slug: PLATFORM_TENANT_SLUG,
        status: 'ACTIVE',
      },
      update: {},
    });

    const user = await tx.user.upsert({
      where: { tenantId_email: { tenantId: PLATFORM_TENANT_ID, email: EMAIL } },
      create: {
        tenantId: PLATFORM_TENANT_ID,
        email: EMAIL,
        status: 'ACTIVE',
        passwordHash,
        mustChangePassword: false,
        firstNameEn: FIRST_NAME,
        lastNameEn: LAST_NAME,
      },
      update: { passwordHash, status: 'ACTIVE', mustChangePassword: false },
    });

    const role = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: ROLE_KEY } });
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { tenantId: PLATFORM_TENANT_ID, userId: user.id, roleId: role.id },
    });
  });

  // eslint-disable-next-line no-console
  console.log(
    `\n✔ Platform ${ROLE_KEY} ready.\n  Sign in at the Admin Portal /login (leave the school field blank)\n  Email:    ${EMAIL}\n  Password: ${process.env.PLATFORM_OWNER_PASSWORD ? '(as provided)' : PASSWORD}\n`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error('Platform owner seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });

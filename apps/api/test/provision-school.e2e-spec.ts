/**
 * Adding a school (src/ops/provision-school.ts) against a real, migrated database: a dry run writes
 * nothing, an applied run creates the school, its roles and a Munaxa-only administrator, and a
 * second run changes nothing.
 */
import { PrismaClient } from '@prisma/client';
import { provisionSchool, readInput } from '../src/ops/provision-school';
import { withPlatform } from '../src/prisma/tenant.helpers';

const prisma = new PrismaClient();
const SLUG = 'provision-e2e';
const input = readInput({
  SCHOOL_SLUG: SLUG,
  SCHOOL_NAME: 'Provision E2E School',
  ADMIN_EMAIL: 'Principal@Provision-E2E.example ',
});

async function cleanUp(): Promise<void> {
  await withPlatform(prisma, async (tx) => {
    await tx.tenant.deleteMany({ where: { slug: SLUG } });
  });
}

describe('provision-school', () => {
  beforeAll(cleanUp);
  afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
  });

  it('refuses input it cannot use', () => {
    expect(() => readInput({ SCHOOL_SLUG: 'Bad Slug', SCHOOL_NAME: '', ADMIN_EMAIL: 'x' })).toThrow(
      /SCHOOL_SLUG[\s\S]*SCHOOL_NAME[\s\S]*ADMIN_EMAIL/,
    );
    expect(input.adminEmail).toBe('principal@provision-e2e.example');
  });

  it('writes nothing on a dry run', async () => {
    const plan = await provisionSchool(prisma, input, false);
    expect(plan[0]).toMatch(/create school "provision-e2e"/);
    expect(plan.at(-1)).toMatch(/create administrator principal@provision-e2e\.example/);
    const tenant = await withPlatform(prisma, (tx) =>
      tx.tenant.findUnique({ where: { slug: SLUG } }),
    );
    expect(tenant).toBeNull();
  });

  it('creates the school, its roles and an administrator without a password', async () => {
    await provisionSchool(prisma, input, true);
    const tenant = await withPlatform(prisma, (tx) =>
      tx.tenant.findUniqueOrThrow({ where: { slug: SLUG } }),
    );
    expect(tenant.status).toBe('ACTIVE');
    const adminPermissions = await withPlatform(prisma, (tx) =>
      tx.rolePermission.count({ where: { role: { tenantId: tenant.id, key: 'SchoolAdmin' } } }),
    );
    expect(adminPermissions).toBeGreaterThan(0);
    const users = await withPlatform(prisma, (tx) =>
      tx.user.findMany({
        where: { tenantId: tenant.id },
        select: {
          email: true,
          status: true,
          passwordHash: true,
          mustChangePassword: true,
          userRoles: { select: { role: { select: { key: true } } } },
        },
      }),
    );
    expect(users).toEqual([
      {
        email: 'principal@provision-e2e.example',
        status: 'ACTIVE',
        passwordHash: null,
        mustChangePassword: false,
        userRoles: [{ role: { key: 'SchoolAdmin' } }],
      },
    ]);
  });

  it('changes nothing when run again', async () => {
    const again = await provisionSchool(prisma, input, true);
    expect(again).toEqual([
      'school "provision-e2e" exists (ACTIVE), left as it is',
      'administrator principal@provision-e2e.example exists, left as it is',
    ]);
  });
});

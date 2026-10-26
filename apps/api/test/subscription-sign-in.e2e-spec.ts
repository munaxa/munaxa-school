/**
 * The subscription half of sign-in, against a real PostgreSQL: a suspended school still signs in
 * (and is then read-only), an archived one is refused at login and at refresh, so an existing
 * session ends at its next rotation. Requires a migrated, seeded DB. Run via `pnpm test:e2e`.
 */
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RoleKey } from '@school/domain';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/services/password.service';
import { RbacService } from '../src/auth/services/rbac.service';
import { SubscriptionService } from '../src/subscription/subscription.service';
import { withPlatform } from '../src/prisma/tenant.helpers';

const TENANT_ID = '55555555-5555-5555-5555-5555555555a7';
const EMAIL = 'admin@sign-in-policy-e2e.example';
const PASSWORD = 'Sup3rSecret!';

describe('Sign-in and the subscription (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let subscriptions: SubscriptionService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);
    subscriptions = moduleRef.get(SubscriptionService);
    const passwords = moduleRef.get(PasswordService);
    const rbac = moduleRef.get(RbacService);

    await withPlatform(prisma, async (tx) => {
      await tx.tenant.deleteMany({ where: { id: TENANT_ID } });
      await tx.tenant.create({
        data: {
          id: TENANT_ID,
          name: 'Sign-in Policy E2E',
          slug: 'sign-in-policy-e2e',
          status: 'ACTIVE',
        },
      });
      await rbac.provisionTenantRoles(tx, TENANT_ID);
      const user = await tx.user.create({
        data: {
          tenantId: TENANT_ID,
          email: EMAIL,
          status: 'ACTIVE',
          mustChangePassword: false,
          passwordHash: await passwords.hash(PASSWORD),
        },
      });
      await rbac.assignRole(tx, TENANT_ID, user.id, RoleKey.SchoolAdmin);
      const plan = await tx.subscriptionPlan.findFirstOrThrow({ orderBy: { sortOrder: 'asc' } });
      await tx.tenantSubscription.create({
        data: { tenantId: TENANT_ID, planId: plan.id, status: 'SUSPENDED' },
      });
    });
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT_ID } }));
    await app.close();
  });

  const login = () =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD, tenantSlug: 'sign-in-policy-e2e' });

  async function setStatus(status: 'SUSPENDED' | 'ARCHIVED') {
    await withPlatform(prisma, (tx) =>
      tx.tenantSubscription.update({ where: { tenantId: TENANT_ID }, data: { status } }),
    );
    subscriptions.invalidate(TENANT_ID);
  }

  it('a suspended school signs in, and is read-only once in', async () => {
    await setStatus('SUSPENDED');
    await login().expect(200);
    await expect(subscriptions.canMutate(TENANT_ID)).resolves.toBe(false);
  });

  it('an archived school is refused at login and its existing session ends at refresh', async () => {
    await setStatus('SUSPENDED');
    const { body } = await login().expect(200);
    await setStatus('ARCHIVED');

    const refused = await login().expect(403);
    expect(refused.body.message).toMatch(/archived/);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: body.refreshToken })
      .expect(403);

    const audited = await withPlatform(prisma, (tx) =>
      tx.auditLog.count({ where: { tenantId: TENANT_ID, action: 'auth.login.blocked' } }),
    );
    expect(audited).toBeGreaterThan(0);
  });
});

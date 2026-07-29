/**
 * End-to-end auth flow against a real PostgreSQL: login → me → refresh rotation →
 * reuse detection → password change. Requires a migrated DB (DATABASE_URL) with a
 * non-superuser role. Run via `pnpm test:e2e`.
 */
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/services/password.service';
import { RbacService } from '../src/auth/services/rbac.service';
import { withPlatform } from '../src/prisma/tenant.helpers';
import { RoleKey } from '@school/domain';

const TENANT_ID = '55555555-5555-5555-5555-555555555555';
const EMAIL = 'admin@auth-e2e.example';
const PASSWORD = 'Sup3rSecret!';

describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);
    const passwords = moduleRef.get(PasswordService);
    const rbac = moduleRef.get(RbacService);

    await withPlatform(prisma, async (tx) => {
      // Clean slate (idempotent re-runs / leftover state from a crashed run).
      await tx.tenant.deleteMany({ where: { id: TENANT_ID } });
      await tx.tenant.create({
        data: { id: TENANT_ID, name: 'Auth E2E', slug: 'auth-e2e', status: 'ACTIVE' },
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
    });
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT_ID } }));
    await app.close();
  });

  const login = () =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD, tenantSlug: 'auth-e2e' });

  it('rejects bad credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: 'wrong', tenantSlug: 'auth-e2e' })
      .expect(401);
  });

  it('logs in and returns a token pair', async () => {
    const res = await login().expect(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.mustChangePassword).toBe(false);
  });

  it('returns the principal with roles and permissions at /auth/me', async () => {
    const { body } = await login().expect(200);
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);
    expect(me.body.roles).toContain('SchoolAdmin');
    expect(me.body.permissions.length).toBeGreaterThan(0);
    expect(me.body.tenantId).toBe(TENANT_ID);
  });

  it('rejects /auth/me without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const { body } = await login().expect(200);
    const first = body.refreshToken as string;

    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first })
      .expect(200);
    expect(rotated.body.refreshToken).not.toBe(first);

    // Reusing the now-rotated token must fail (and revoke the family).
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first })
      .expect(401);

    // The rotated token is now also revoked (reuse triggered family revocation).
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);
  });

  it('changes password and invalidates old sessions', async () => {
    const { body } = await login().expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/change')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .send({ currentPassword: PASSWORD, newPassword: 'N3wStrongPass!' })
      .expect(204);

    // Old refresh token is revoked after password change.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: body.refreshToken })
      .expect(401);

    // Restore password for idempotent re-runs.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: 'N3wStrongPass!', tenantSlug: 'auth-e2e' })
      .expect(200);
  });

  it('transparently upgrades a legacy bcrypt hash to scrypt on login', async () => {
    const email = 'legacy@auth-e2e.example';
    const bcrypt = await import('bcryptjs');
    const legacyHash = await bcrypt.hash(PASSWORD, 10);
    const userId = await withPlatform(prisma, async (tx) => {
      const u = await tx.user.create({
        data: {
          tenantId: TENANT_ID,
          email,
          status: 'ACTIVE',
          mustChangePassword: false,
          passwordHash: legacyHash,
        },
      });
      return u.id;
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'auth-e2e' })
      .expect(200);

    const after = await withPlatform(prisma, (tx) =>
      tx.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } }),
    );
    expect(after.passwordHash!.startsWith('scrypt:')).toBe(true);

    // The upgraded hash still authenticates.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'auth-e2e' })
      .expect(200);
  });

  it('locks the account after repeated failures — even with the correct password', async () => {
    const email = 'lockout@auth-e2e.example';
    const passwords = app.get(PasswordService);
    await withPlatform(prisma, async (tx) => {
      await tx.user.create({
        data: {
          tenantId: TENANT_ID,
          email,
          status: 'ACTIVE',
          mustChangePassword: false,
          passwordHash: await passwords.hash(PASSWORD),
        },
      });
    });

    const attempt = (password: string) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password, tenantSlug: 'auth-e2e' });

    for (let i = 0; i < 5; i++) {
      await attempt('Wr0ngPassword!').expect(401);
    }
    // Correct password is now rejected with 403 (locked), not 401 — guessing can't be confirmed.
    const locked = await attempt(PASSWORD).expect(403);
    expect(locked.body.message).toMatch(/failed attempts/i);
  });
});

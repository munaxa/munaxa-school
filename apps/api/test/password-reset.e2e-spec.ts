/**
 * End-to-end coverage for the Forgot Password / Temporary Password reset workflow against a real
 * PostgreSQL (RLS-enforced). Requires a migrated DB (DATABASE_URL) with a non-superuser role.
 * Run via `pnpm test:e2e`.
 *
 * Scenarios (per spec):
 *   1. Request password reset (known email)        6. Expired temporary password
 *   2. Non-existent email (anti-enumeration)       7. Reuse prevention
 *   3. Rate-limit protection (per email)           8. Audit logging
 *   4. Temporary-password login                    9. Route protection (mustChangePassword gate)
 *   5. Forced password change                     10. Multi-tenant isolation
 */
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/services/password.service';
import { RbacService } from '../src/auth/services/rbac.service';
import { MailService } from '../src/mail/mail.service';
import { withPlatform } from '../src/prisma/tenant.helpers';
import { RoleKey } from '@school/domain';

const TENANT_A = '66666666-6666-6666-6666-666666666661';
const TENANT_B = '66666666-6666-6666-6666-666666666662';
const SLUG_A = 'reset-e2e-a';
const SLUG_B = 'reset-e2e-b';
const PASSWORD = 'Sup3rSecret!';

describe('Password reset / temporary password (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwords: PasswordService;
  // Captures the temp password the API generated and "emailed", keyed by recipient — the value is
  // never exposed via the HTTP surface, so the mail spy is how the test recovers it.
  const emailed = new Map<string, string>();

  const seedUser = (tenantId: string, email: string) =>
    withPlatform(prisma, async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId,
          email,
          firstNameEn: 'Test',
          lastNameEn: 'User',
          status: 'ACTIVE',
          mustChangePassword: false,
          passwordHash: await passwords.hash(PASSWORD),
        },
      });
      const rbac = app.get(RbacService);
      await rbac.assignRole(tx, tenantId, user.id, RoleKey.SchoolAdmin);
      return user.id;
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);
    passwords = moduleRef.get(PasswordService);
    const rbac = moduleRef.get(RbacService);

    // Intercept outbound mail to capture the generated temporary password for assertions.
    const mail = moduleRef.get(MailService);
    jest.spyOn(mail, 'sendTemporaryPassword').mockImplementation((params) => {
      emailed.set(params.to, params.temporaryPassword);
      return Promise.resolve({ sent: true });
    });

    await withPlatform(prisma, async (tx) => {
      for (const [id, slug] of [
        [TENANT_A, SLUG_A],
        [TENANT_B, SLUG_B],
      ] as const) {
        await tx.tenant.deleteMany({ where: { id } });
        await tx.tenant.create({ data: { id, name: slug, slug, status: 'ACTIVE' } });
        await rbac.provisionTenantRoles(tx, id);
      }
    });
  });

  afterAll(async () => {
    await withPlatform(prisma, async (tx) => {
      await tx.passwordResetAudit.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
      await tx.tenant.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } });
    });
    await app.close();
  });

  const requestReset = (email: string, tenantSlug = SLUG_A) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/password/reset/request')
      .send({ email, tenantSlug });

  const login = (email: string, password: string, tenantSlug = SLUG_A) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password, tenantSlug });

  const userById = (id: string) =>
    withPlatform(prisma, (tx) => tx.user.findUniqueOrThrow({ where: { id } }));

  const audits = (email: string) =>
    withPlatform(prisma, (tx) =>
      tx.passwordResetAudit.findMany({ where: { email }, orderBy: { createdAt: 'asc' } }),
    );

  it('1. issues a temporary password and flags the account on a known email', async () => {
    const email = 'known@reset-e2e.example';
    const id = await seedUser(TENANT_A, email);
    await requestReset(email).expect(202);

    const user = await userById(id);
    expect(user.mustChangePassword).toBe(true);
    expect(user.passwordResetIssuedAt).not.toBeNull();
    expect(user.passwordResetExpiresAt).not.toBeNull();
    // The temp password is hashed (scrypt), never stored in plaintext; the old password is gone.
    expect(user.passwordHash?.startsWith('scrypt:')).toBe(true);
    expect(await passwords.verify(PASSWORD, user.passwordHash!)).toBe(false);
  });

  it('2. responds 202 for a non-existent email and never reveals existence', async () => {
    const email = 'ghost@reset-e2e.example';
    await requestReset(email).expect(202);
    const rows = await audits(email);
    // The request is still audited (null user) for abuse analysis, but no temp password is issued.
    expect(rows.some((r) => r.action === 'reset.request')).toBe(true);
    expect(rows.some((r) => r.action === 'reset.email_sent')).toBe(false);
  });

  it('3. rate-limits repeated reset requests for the same email', async () => {
    const email = 'flood@reset-e2e.example';
    await seedUser(TENANT_A, email);
    for (let i = 0; i < 6; i++) await requestReset(email).expect(202);
    const rows = await audits(email);
    const issued = rows.filter((r) => r.action === 'reset.email_sent').length;
    // At most RESET_EMAIL_MAX (3) temporary passwords are issued within the window.
    expect(issued).toBeLessThanOrEqual(3);
    expect(issued).toBeGreaterThan(0);
  });

  it('4. logs in with the temporary password and reports mustChangePassword', async () => {
    const email = 'login@reset-e2e.example';
    await seedUser(TENANT_A, email);
    await requestReset(email).expect(202);
    const temp = currentTempPassword(email);

    const res = await login(email, temp).expect(200);
    expect(res.body.mustChangePassword).toBe(true);
    expect(res.body.accessToken).toBeDefined();
  });

  it('5. + 9. blocks protected routes until the password is changed, then unblocks', async () => {
    const email = 'forced@reset-e2e.example';
    await seedUser(TENANT_A, email);
    await requestReset(email).expect(202);
    const temp = currentTempPassword(email);
    const { body } = await login(email, temp).expect(200);
    const auth = { Authorization: `Bearer ${body.accessToken}` };

    // /auth/me is whitelisted during the gate…
    await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth).expect(200);
    // …but a protected resource is blocked with 403 PASSWORD_CHANGE_REQUIRED.
    const blocked = await request(app.getHttpServer()).get('/api/v1/users').set(auth).expect(403);
    expect(blocked.body.code ?? blocked.body.message).toBeDefined();

    // Change the password (whitelisted during the gate).
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/change')
      .set(auth)
      .send({
        currentPassword: temp,
        newPassword: 'Br4ndNewPass!',
        confirmPassword: 'Br4ndNewPass!',
      })
      .expect(204);

    const after = await userByEmail(email);
    expect(after.mustChangePassword).toBe(false);
    expect(after.lastPasswordChangeAt).not.toBeNull();
    expect(after.passwordResetExpiresAt).toBeNull();

    // A fresh login now yields a token WITHOUT the gate, so protected routes work.
    const fresh = await login(email, 'Br4ndNewPass!').expect(200);
    expect(fresh.body.mustChangePassword).toBe(false);
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${fresh.body.accessToken}`)
      .expect(200);
  });

  it('6. rejects an expired temporary password and audits the attempt', async () => {
    const email = 'expired@reset-e2e.example';
    const id = await seedUser(TENANT_A, email);
    await requestReset(email).expect(202);
    const temp = currentTempPassword(email);
    // Fast-forward the expiry into the past.
    await withPlatform(prisma, (tx) =>
      tx.user.update({
        where: { id },
        data: { passwordResetExpiresAt: new Date(Date.now() - 1000) },
      }),
    );
    const res = await login(email, temp).expect(403);
    expect(res.body.message).toMatch(/expired/i);
    const rows = await audits(email);
    expect(rows.some((r) => r.action === 'reset.expired_attempt')).toBe(true);
  });

  it('7. prevents reuse of a temporary password after it has been changed', async () => {
    const email = 'reuse@reset-e2e.example';
    await seedUser(TENANT_A, email);
    await requestReset(email).expect(202);
    const temp = currentTempPassword(email);
    const { body } = await login(email, temp).expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/change')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .send({ currentPassword: temp, newPassword: 'An0therPass!', confirmPassword: 'An0therPass!' })
      .expect(204);

    // The old temporary password no longer works.
    await login(email, temp).expect(401);
  });

  it('8. records the full audit trail across the reset lifecycle', async () => {
    const email = 'audit@reset-e2e.example';
    await seedUser(TENANT_A, email);
    await requestReset(email).expect(202);
    const temp = currentTempPassword(email);
    const { body } = await login(email, temp).expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/change')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .send({ currentPassword: temp, newPassword: 'Aud1tPass!!', confirmPassword: 'Aud1tPass!!' })
      .expect(204);

    const actions = (await audits(email)).map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'reset.request',
        'reset.email_sent',
        'reset.first_login',
        'reset.completed',
      ]),
    );
  });

  it('10. isolates resets between tenants that share an email', async () => {
    const email = 'shared@reset-e2e.example';
    const idA = await seedUser(TENANT_A, email);
    const idB = await seedUser(TENANT_B, email);

    await requestReset(email, SLUG_A).expect(202);

    const a = await userById(idA);
    const b = await userById(idB);
    expect(a.mustChangePassword).toBe(true); // tenant A was reset
    expect(b.mustChangePassword).toBe(false); // tenant B untouched
    expect(b.passwordResetIssuedAt).toBeNull();
  });

  // ----- helpers -----------------------------------------------------------
  /** The temp password is never returned by the API — recover it from the mail spy capture. */
  function currentTempPassword(email: string): string {
    const temp = emailed.get(email);
    if (!temp) throw new Error(`No temporary password was emailed to ${email}`);
    return temp;
  }

  function userByEmail(email: string) {
    return withPlatform(prisma, (tx) => tx.user.findFirstOrThrow({ where: { email } }));
  }
});

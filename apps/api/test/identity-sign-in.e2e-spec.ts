/**
 * Sign in with Munaxa Identity, end to end against a real PostgreSQL: the start sets the binding
 * cookie and sends the browser to Identity, the callback redeems the code (Identity's token
 * endpoint is stubbed with an id token signed by a test key), links the School user by verified
 * email on first use and signs them in with the ordinary session cookies. A second Identity
 * account with the same email is refused once the first is linked. A School admin needs Identity's
 * two-step verification, at linking and at every sign-in. With STAFF_PASSWORD_SIGN_IN=disabled,
 * staff cannot use a School password at all; parents and students still can.
 */
import { createHash, createSign, generateKeyPairSync, randomBytes } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RoleKey } from '@school/domain';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { withPlatform as WithPlatform } from '../src/prisma/tenant.helpers';

const TENANT_ID = '66666666-6666-6666-6666-666666666666';
const SLUG = 'identity-e2e';
const EMAIL = 'teacher@identity-e2e.example';
const ADMIN_EMAIL = 'admin@identity-e2e.example';
const ADMIN_PASSWORD = 'Sup3rSecret!';
const PARENT_EMAIL = 'parent@identity-e2e.example';
const PARENT_PASSWORD = 'Par3ntSecret!';
const ISSUER = 'https://id.test.munaxa.com';
const CLIENT_ID = 'school-identity-e2e';
const SECRET = 'c'.repeat(43);

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });

Object.assign(process.env, {
  IDENTITY_SIGN_IN: 'enabled',
  STAFF_PASSWORD_SIGN_IN: 'disabled',
  IDENTITY_ISSUER: ISSUER,
  IDENTITY_SIGN_IN_REDIRECT_URI: 'https://school.test.munaxa.com/api/v1/auth/identity/callback',
  IDENTITY_APP_REDIRECT_URI: 'com.munaxa.teacher://signed-in',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'e2e-refresh-secret-0123456789',
  IDENTITY_SIGN_IN_CLIENTS: `${SLUG}|${CLIENT_ID}|${SLUG}`,
  IDENTITY_SIGN_IN_CLIENT_SECRETS: `${CLIENT_ID}=${SECRET}`,
  IDENTITY_PUBLIC_KEYS: JSON.stringify([
    { kid: 'k1', publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString() },
  ]),
});

const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');

function idToken(subject: string, nonce: string, email: string, mfa: boolean): string {
  const now = Math.floor(Date.now() / 1_000);
  const input = `${b64({ alg: 'ES256', typ: 'JWT', kid: 'k1' })}.${b64({
    iss: ISSUER,
    sub: subject,
    aud: CLIENT_ID,
    exp: now + 300,
    iat: now,
    nonce,
    email: email.toUpperCase(),
    email_verified: true,
    org: SLUG,
    amr: mfa ? ['pwd', 'otp'] : ['pwd'],
    ...(mfa ? { acr: 'mfa' } : {}),
  })}`;
  const signature = createSign('SHA256')
    .update(input)
    .sign({ key: privateKey, dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
  return `${input}.${signature}`;
}

const cookieHeader = (setCookie: string[] | string | undefined): string[] =>
  (Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []).map(
    (c) => c.split(';')[0] ?? '',
  );

describe('Sign in with Munaxa Identity (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let withPlatform: typeof WithPlatform;
  const realFetch = global.fetch;

  beforeAll(async () => {
    // Imported after the environment above, which ConfigModule validates as it loads.
    const { AppModule } = await import('../src/app.module');
    ({ withPlatform } = await import('../src/prisma/tenant.helpers'));
    const prismaModule = await import('../src/prisma/prisma.service');
    const { RbacService } = await import('../src/auth/services/rbac.service');
    const { PasswordService } = await import('../src/auth/services/password.service');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    // main.ts installs cookie-parser; the e2e app is built without main.ts.
    const cookieParser = (await import('cookie-parser')).default;
    app.use(cookieParser());
    await app.init();

    prisma = moduleRef.get(prismaModule.PrismaService);
    const rbac = moduleRef.get(RbacService);
    const passwords = moduleRef.get(PasswordService);
    await withPlatform(prisma, async (tx) => {
      await tx.tenant.deleteMany({ where: { id: TENANT_ID } });
      await tx.tenant.create({
        data: { id: TENANT_ID, name: 'Identity E2E', slug: SLUG, status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT_ID);
      const user = await tx.user.create({
        data: { tenantId: TENANT_ID, email: EMAIL, status: 'ACTIVE', mustChangePassword: false },
      });
      await rbac.assignRole(tx, TENANT_ID, user.id, RoleKey.Teacher);
      const admin = await tx.user.create({
        data: {
          tenantId: TENANT_ID,
          email: ADMIN_EMAIL,
          status: 'ACTIVE',
          mustChangePassword: false,
          passwordHash: await passwords.hash(ADMIN_PASSWORD),
        },
      });
      await rbac.assignRole(tx, TENANT_ID, admin.id, RoleKey.SchoolAdmin);
      const parent = await tx.user.create({
        data: {
          tenantId: TENANT_ID,
          email: PARENT_EMAIL,
          status: 'ACTIVE',
          mustChangePassword: false,
          passwordHash: await passwords.hash(PARENT_PASSWORD),
        },
      });
      await rbac.assignRole(tx, TENANT_ID, parent.id, RoleKey.Parent);
    });
  });

  afterAll(async () => {
    global.fetch = realFetch;
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT_ID } }));
    await app.close();
  });

  async function signIn(subject: string, email = EMAIL, mfa = false, appChallenge?: string) {
    const start = await request(app.getHttpServer())
      .get('/api/v1/auth/identity/start')
      .query({ school: SLUG, ...(appChallenge ? { app: appChallenge } : {}) });
    expect(start.status).toBe(303);
    const authorize = new URL(start.headers.location as string);
    expect(authorize.origin + authorize.pathname).toBe(`${ISSUER}/api/auth/oidc/authorize`);
    const state = authorize.searchParams.get('state') ?? '';
    const nonce = authorize.searchParams.get('nonce') ?? '';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id_token: idToken(subject, nonce, email, mfa) }),
    });

    return request(app.getHttpServer())
      .get('/api/v1/auth/identity/callback')
      .query({ code: 'the-code', state })
      .set('Cookie', cookieHeader(start.headers['set-cookie']));
  }

  it('tells the sign-in page to offer Munaxa only', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/identity/enabled');
    expect(res.body).toEqual({ enabled: true, staffPasswords: 'disabled' });
  });

  it('sends a school that is not configured back to sign-in', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/identity/start')
      .query({ school: 'not-configured' });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/login?identity=unavailable');
  });

  it('refuses a callback without the binding cookie (login CSRF)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/identity/callback')
      .query({ code: 'c', state: 's' });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/login?identity=failed');
  });

  it('signs the School user in, links the Identity subject, and the session works', async () => {
    const res = await signIn('identity-subject-1');
    expect(res.status).toBe(200);
    expect(res.text).toContain('url=/"');
    const cookies = cookieHeader(res.headers['set-cookie']);
    expect(cookies.some((c) => c.startsWith('munaxa_at='))).toBe(true);

    const me = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookies);
    expect(me.status).toBe(200);

    const user = await withPlatform(prisma, (tx) =>
      tx.user.findFirst({ where: { tenantId: TENANT_ID, email: EMAIL } }),
    );
    expect(user?.identitySubject).toBe('identity-subject-1');
  });

  it('refuses another Identity account with the same email once one is linked', async () => {
    const res = await signIn('identity-subject-2');
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/login?identity=no-account');
  });

  const subjectOf = async (email: string) =>
    (
      await withPlatform(prisma, (tx) =>
        tx.user.findFirst({ where: { tenantId: TENANT_ID, email } }),
      )
    )?.identitySubject ?? null;

  it('refuses a School admin without two-step verification, and links nothing', async () => {
    const res = await signIn('admin-subject', ADMIN_EMAIL, false);
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/login?identity=mfa-required');
    expect(cookieHeader(res.headers['set-cookie']).some((c) => c.startsWith('munaxa_at='))).toBe(
      false,
    );
    expect(await subjectOf(ADMIN_EMAIL)).toBeNull();
  });

  it('links and signs in a School admin who used two-step verification, and asks every time', async () => {
    const res = await signIn('admin-subject', ADMIN_EMAIL, true);
    expect(res.status).toBe(200);
    expect(cookieHeader(res.headers['set-cookie']).some((c) => c.startsWith('munaxa_at='))).toBe(
      true,
    );
    expect(await subjectOf(ADMIN_EMAIL)).toBe('admin-subject');

    const again = await signIn('admin-subject', ADMIN_EMAIL, false);
    expect(again.headers.location).toBe('/login?identity=mfa-required');
  });

  it('refuses a staff password sign-in, and keeps parents on their password', async () => {
    const staff = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD, tenantSlug: SLUG });
    expect(staff.status).toBe(403);
    expect(staff.body.message).toBe('Staff sign in with Munaxa');

    const wrong = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: ADMIN_EMAIL, password: 'not-the-password', tenantSlug: SLUG });
    expect(wrong.status).toBe(401);

    const parent = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: PARENT_EMAIL, password: PARENT_PASSWORD, tenantSlug: SLUG });
    expect(parent.status).toBe(200);
  });

  describe('the teacher app (system browser, PKCE hand-off)', () => {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');

    const handoffFrom = (location: string): URL => {
      const url = new URL(location);
      expect(`${url.protocol}//${url.host}${url.pathname}`).toBe('com.munaxa.teacher://signed-in');
      return url;
    };

    it('returns to the app with a sealed hand-off, sets no web session, and redeems it once', async () => {
      const callback = await signIn('identity-subject-1', EMAIL, false, challenge);
      expect(callback.status).toBe(303);
      expect(cookieHeader(callback.headers['set-cookie']).some((c) => c.startsWith('access'))).toBe(
        false,
      );
      const handoff = handoffFrom(callback.headers.location as string).searchParams.get('handoff');
      expect(handoff).toBeTruthy();

      // Somebody who caught the hand-off but has no verifier gets nothing.
      await request(app.getHttpServer())
        .post('/api/v1/auth/identity/app-session')
        .send({ handoff, verifier: randomBytes(32).toString('base64url') })
        .expect(401);

      const session = await request(app.getHttpServer())
        .post('/api/v1/auth/identity/app-session')
        .send({ handoff, verifier })
        .expect(200);
      expect(session.body.accessToken).toEqual(expect.any(String));
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${session.body.accessToken as string}`)
        .expect(200);

      // A second redemption is refresh-token reuse: refused, and the session it opened ends.
      await request(app.getHttpServer())
        .post('/api/v1/auth/identity/app-session')
        .send({ handoff, verifier })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.body.refreshToken })
        .expect(401);
    });

    it('tells the app why, instead of the web page, when the sign-in is refused', async () => {
      const callback = await signIn('admin-subject', ADMIN_EMAIL, false, challenge);
      expect(callback.status).toBe(303);
      expect(handoffFrom(callback.headers.location as string).searchParams.get('error')).toBe(
        'mfa-required',
      );
    });

    it('refuses a start whose challenge is not an S256 challenge', async () => {
      const start = await request(app.getHttpServer())
        .get('/api/v1/auth/identity/start')
        .query({ school: SLUG, app: 'short' });
      expect(start.status).toBe(303);
      expect(handoffFrom(start.headers.location as string).searchParams.get('error')).toBe(
        'unavailable',
      );
      expect(start.headers['set-cookie']).toBeUndefined();
    });
  });
});

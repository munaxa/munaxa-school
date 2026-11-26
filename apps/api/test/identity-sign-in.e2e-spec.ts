/**
 * Sign in with Munaxa Identity, end to end against a real PostgreSQL: the start sets the binding
 * cookie and sends the browser to Identity, the callback redeems the code (Identity's token
 * endpoint is stubbed with an id token signed by a test key), links the School user by verified
 * email on first use and signs them in with the ordinary session cookies. A second Identity
 * account with the same email is refused once the first is linked. A School admin is never linked
 * by email alone: only their next password sign-in completes the link (review M-1).
 */
import { createSign, generateKeyPairSync } from 'node:crypto';
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
const ISSUER = 'https://id.test.munaxa.com';
const CLIENT_ID = 'school-identity-e2e';
const SECRET = 'c'.repeat(43);

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });

Object.assign(process.env, {
  IDENTITY_SIGN_IN: 'enabled',
  IDENTITY_ISSUER: ISSUER,
  IDENTITY_SIGN_IN_REDIRECT_URI: 'https://school.test.munaxa.com/api/v1/auth/identity/callback',
  IDENTITY_SIGN_IN_CLIENTS: `${SLUG}|${CLIENT_ID}|${SLUG}`,
  IDENTITY_SIGN_IN_CLIENT_SECRETS: `${CLIENT_ID}=${SECRET}`,
  IDENTITY_PUBLIC_KEYS: JSON.stringify([
    { kid: 'k1', publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString() },
  ]),
});

const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');

function idToken(subject: string, nonce: string, email: string): string {
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
    });
  });

  afterAll(async () => {
    global.fetch = realFetch;
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT_ID } }));
    await app.close();
  });

  async function signIn(subject: string, email = EMAIL) {
    const start = await request(app.getHttpServer())
      .get('/api/v1/auth/identity/start')
      .query({ school: SLUG });
    expect(start.status).toBe(303);
    const authorize = new URL(start.headers.location as string);
    expect(authorize.origin + authorize.pathname).toBe(`${ISSUER}/api/auth/oidc/authorize`);
    const state = authorize.searchParams.get('state') ?? '';
    const nonce = authorize.searchParams.get('nonce') ?? '';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id_token: idToken(subject, nonce, email) }),
    });

    return request(app.getHttpServer())
      .get('/api/v1/auth/identity/callback')
      .query({ code: 'the-code', state })
      .set('Cookie', cookieHeader(start.headers['set-cookie']));
  }

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

  it('never links a School admin by email alone', async () => {
    const res = await signIn('admin-subject', ADMIN_EMAIL);
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/login?identity=link-required');
    expect(cookieHeader(res.headers['set-cookie']).some((c) => c.startsWith('munaxa_at='))).toBe(
      false,
    );
    expect(await subjectOf(ADMIN_EMAIL)).toBeNull();
  });

  it('links a School admin at their next password sign-in, then Munaxa sign-in works', async () => {
    const offered = await signIn('admin-subject', ADMIN_EMAIL);
    const offer = cookieHeader(offered.headers['set-cookie']).filter((c) =>
      c.startsWith('munaxa_identity_link='),
    );
    expect(offer).toHaveLength(1);

    // A tampered offer is ignored, and the password sign-in still succeeds.
    const tampered = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', [`${offer[0]?.split('.')[0] ?? ''}.forged`])
      .send({ identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD, tenantSlug: SLUG });
    expect(tampered.status).toBe(200);
    expect(await subjectOf(ADMIN_EMAIL)).toBeNull();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', offer)
      .send({ identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD, tenantSlug: SLUG });
    expect(login.status).toBe(200);
    expect(await subjectOf(ADMIN_EMAIL)).toBe('admin-subject');

    const res = await signIn('admin-subject', ADMIN_EMAIL);
    expect(res.status).toBe(200);
    expect(cookieHeader(res.headers['set-cookie']).some((c) => c.startsWith('munaxa_at='))).toBe(
      true,
    );
  });
});

/**
 * Munaxa Identity access tokens against a real PostgreSQL (SC-07).
 *
 * Identity itself is replaced by two things it would provide: an ES256 key pair (the test mints
 * tokens the way Identity's TokenService does) and a local introspection endpoint that answers
 * `{ active, sub, tid, sid }`. What is proved is what School trusts:
 *
 * - a token resolves only through a stored binding (organisation → school) and a linked account
 *   (`User.platformSubject`) in that school; `tid` alone selects nothing;
 * - an organisation's token acts in its own school only, even for a person linked in two schools;
 * - grants come from the token's `school:` permissions, and RLS still scopes every query;
 * - a revoked session, another audience, an unknown organisation, a disabled account and the
 *   HS256-with-public-key confusion all answer 401;
 * - the runtime role cannot write a binding (infra/postgres/app-role.sql).
 *
 * Requires a migrated, seeded DB and DIRECT_DATABASE_URL (the owner) to write the bindings.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { withPlatform } from '../src/prisma/tenant.helpers';
import { mintEs256, mintHs256WithPublicKey, testSigningKey } from './identity-keys';

const ISSUER = 'https://identity.e2e.munaxa.test';
const AUDIENCE = 'munaxa-school';
const TENANT_A = '55555555-5555-5555-5555-5555555555c1';
const TENANT_B = '55555555-5555-5555-5555-5555555555c2';
const ORG_A = 'org_e2e_a';
const ORG_B = 'org_e2e_b';
const ORG_UNBOUND = 'org_e2e_unbound';
const SUBJECT = 'acct_e2e_teacher';
const SUBJECT_B_ONLY = 'acct_e2e_b_only';
const SUBJECT_DISABLED = 'acct_e2e_disabled';

const key = testSigningKey('identity-e2e-1');
const ENV_KEYS = [
  'PLATFORM_AUTH_ISSUER',
  'PLATFORM_AUTH_AUDIENCE',
  'PLATFORM_AUTH_ALGORITHM',
  'PLATFORM_AUTH_PUBLIC_KEYS',
  'PLATFORM_AUTH_INTROSPECTION_URL',
  'PLATFORM_AUTH_REVOCATION_CACHE_MS',
] as const;

const revokedSessions = new Set<string>();
const introspections: string[] = [];

/** Identity's introspection: decodes the presented token (already verified by School) and answers. */
const introspection = (): Server =>
  createServer((req, res) => {
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    introspections.push(token);
    const claims = JSON.parse(
      Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as {
      sub: string;
      tid: string;
      sid: string;
    };
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify(
        revokedSessions.has(claims.sid)
          ? { active: false }
          : { active: true, sub: claims.sub, tid: claims.tid, sid: claims.sid },
      ),
    );
  });

const now = () => Math.floor(Date.now() / 1000);

const token = (overrides: Record<string, unknown> = {}): string =>
  mintEs256(key, {
    sub: SUBJECT,
    tid: ORG_A,
    sid: `ses_${Math.random().toString(36).slice(2)}`,
    iss: ISSUER,
    aud: ['munaxa-work', AUDIENCE],
    iat: now(),
    exp: now() + 900,
    jti: 'jti',
    ver: 1,
    perms: [
      'school:school:manage',
      'school:attendance:read',
      'work:people:person:read',
      'school:*',
    ],
    ...overrides,
  });

describe('Munaxa Identity access tokens (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: PrismaClient;
  let server: Server;
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeAll(async () => {
    server = introspection();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;

    for (const name of ENV_KEYS) saved[name] = process.env[name];
    process.env.PLATFORM_AUTH_ISSUER = ISSUER;
    process.env.PLATFORM_AUTH_AUDIENCE = AUDIENCE;
    process.env.PLATFORM_AUTH_ALGORITHM = 'ES256';
    process.env.PLATFORM_AUTH_PUBLIC_KEYS = JSON.stringify([
      { kid: key.kid, publicKey: key.publicKeyPem },
    ]);
    process.env.PLATFORM_AUTH_INTROSPECTION_URL = `http://127.0.0.1:${port}/api/auth/introspect`;
    // Every request asks, so a revocation is visible to the very next request.
    process.env.PLATFORM_AUTH_REVOCATION_CACHE_MS = '0';

    // Imported after the environment is set: ConfigModule reads it when AppModule is evaluated.
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const ownerUrl = process.env.DIRECT_DATABASE_URL;
    if (!ownerUrl) throw new Error('DIRECT_DATABASE_URL (the owner) is required to write bindings');
    owner = new PrismaClient({ datasourceUrl: ownerUrl });

    await withPlatform(prisma, async (tx) => {
      await tx.tenant.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } });
      for (const [id, slug] of [
        [TENANT_A, 'identity-e2e-a'],
        [TENANT_B, 'identity-e2e-b'],
      ] as const) {
        await tx.tenant.create({ data: { id, name: slug, slug, status: 'ACTIVE' } });
        await tx.school.create({ data: { tenantId: id, nameEn: `School ${slug}`, nameAr: slug } });
      }
      // The same person, linked in both schools; one linked only in B; one disabled in A.
      for (const tenantId of [TENANT_A, TENANT_B]) {
        await tx.user.create({
          data: {
            tenantId,
            email: `teacher@${tenantId}.example`,
            status: 'ACTIVE',
            mustChangePassword: false,
            platformSubject: SUBJECT,
          },
        });
      }
      await tx.user.create({
        data: {
          tenantId: TENANT_B,
          email: 'b-only@identity-e2e.example',
          status: 'ACTIVE',
          platformSubject: SUBJECT_B_ONLY,
        },
      });
      await tx.user.create({
        data: {
          tenantId: TENANT_A,
          email: 'disabled@identity-e2e.example',
          status: 'DISABLED',
          platformSubject: SUBJECT_DISABLED,
        },
      });
    });

    await owner.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_platform', 'on', true)`;
      await tx.tenantPlatformBinding.createMany({
        data: [
          { tenantId: TENANT_A, platformIssuer: ISSUER, platformTenantId: ORG_A, createdBy: 'e2e' },
          { tenantId: TENANT_B, platformIssuer: ISSUER, platformTenantId: ORG_B, createdBy: 'e2e' },
        ],
      });
    });
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) =>
      tx.tenant.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } }),
    );
    await owner.$disconnect();
    await app.close();
    await new Promise((resolve) => server.close(resolve));
    for (const name of ENV_KEYS) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  const get = (path: string, bearer: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${bearer}`);

  it('resolves the linked account in the school bound to the organisation', async () => {
    const res = await get('/auth/me', token()).expect(200);
    expect(res.body).toMatchObject({
      tenantId: TENANT_A,
      isPlatform: false,
      authSource: 'identity',
    });
    // School grants only: another product's grant and the wildcard confer nothing.
    expect([...res.body.permissions].sort()).toEqual(['attendance:read', 'school:manage']);
  });

  it("acts in its own school only: RLS scopes the organisation's token to tenant A", async () => {
    const a = await get('/schools', token()).expect(200);
    expect(a.body.map((s: { tenantId: string }) => s.tenantId)).toEqual([TENANT_A]);
    const b = await get('/schools', token({ tid: ORG_B })).expect(200);
    expect(b.body.map((s: { tenantId: string }) => s.tenantId)).toEqual([TENANT_B]);
  });

  it('enforces permissions from the token', async () => {
    await get('/schools', token({ perms: ['school:attendance:read'] })).expect(403);
  });

  it('refuses an organisation bound to no school', async () => {
    await get('/auth/me', token({ tid: ORG_UNBOUND })).expect(401);
  });

  it("refuses a subject not linked in the organisation's school", async () => {
    await get('/auth/me', token({ sub: SUBJECT_B_ONLY })).expect(401);
    await get('/auth/me', token({ sub: SUBJECT_B_ONLY, tid: ORG_B })).expect(200);
  });

  it('refuses a disabled account', async () => {
    await get('/auth/me', token({ sub: SUBJECT_DISABLED })).expect(401);
  });

  it('refuses another audience, another issuer and an expired token', async () => {
    await get('/auth/me', token({ aud: ['munaxa-work'] })).expect(401);
    await get('/auth/me', token({ iss: 'https://identity.elsewhere.test' })).expect(401);
    await get('/auth/me', token({ exp: now() - 120 })).expect(401);
  });

  it('refuses HS256 keyed with the public key', async () => {
    const forged = mintHs256WithPublicKey(key, {
      sub: SUBJECT,
      tid: ORG_A,
      sid: 'ses_forged',
      iss: ISSUER,
      aud: [AUDIENCE],
      exp: now() + 900,
    });
    await get('/auth/me', forged).expect(401);
  });

  it('ends access when Identity says the session was revoked', async () => {
    const sid = 'ses_revoked_e2e';
    const bearer = token({ sid });
    await get('/auth/me', bearer).expect(200);
    revokedSessions.add(sid);
    await get('/auth/me', bearer).expect(401);
  });

  it('never asks Identity about a token it could not verify', async () => {
    introspections.length = 0;
    await get('/auth/me', token({ aud: ['munaxa-work'] })).expect(401);
    await get('/auth/me', token({ tid: ORG_UNBOUND })).expect(401);
    expect(introspections).toHaveLength(0);
  });

  it("refuses School's password change to an Identity sign-in", async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/change')
      .set('Authorization', `Bearer ${token()}`)
      .send({ currentPassword: 'x', newPassword: 'N3w-Passw0rd!long' })
      .expect(403);
  });

  it('does not let the runtime role write a binding', async () => {
    await expect(
      withPlatform(prisma, (tx) =>
        tx.tenantPlatformBinding.create({
          data: {
            tenantId: TENANT_A,
            platformIssuer: ISSUER,
            platformTenantId: 'org_e2e_injected',
            createdBy: 'runtime',
          },
        }),
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});

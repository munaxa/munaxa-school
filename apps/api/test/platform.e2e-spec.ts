/**
 * End-to-end tests for the platform (super-admin) tenant-database promotion wizard: the tracked
 * state machine (REQUESTED → … → ACTIVE), invalid-transition guards, restart/abort, and RBAC.
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

const TENANT = 'a1a1a1a1-1111-4111-8111-111111111111';
const PASSWORD = 'Sup3rSecret!';

describe('Platform tenant-database wizard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string; // SchoolAdmin holds '*' incl. platform:tenant:manage
  let teacherToken: string; // no platform permission

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());
  const base = '/api/v1/platform/tenant-databases';

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
    const hash = await passwords.hash(PASSWORD);

    await withPlatform(prisma, async (tx) => {
      await tx.tenant.deleteMany({ where: { id: TENANT } });
      await tx.tenant.create({
        data: { id: TENANT, name: 'plat', slug: 'plat', status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT);
      const mk = async (email: string, role: RoleKey) => {
        const u = await tx.user.create({
          data: {
            tenantId: TENANT,
            email,
            status: 'ACTIVE',
            passwordHash: hash,
            mustChangePassword: false,
          },
        });
        await rbac.assignRole(tx, TENANT, u.id, role);
      };
      await mk('admin@plat.example', RoleKey.SchoolAdmin);
      await mk('teacher@plat.example', RoleKey.Teacher);
    });

    adminToken = await login('admin@plat.example');
    teacherToken = await login('teacher@plat.example');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'plat' })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('blocks non-platform users (RBAC)', async () => {
    await http().get(base).set(auth(teacherToken)).expect(403);
    await http().post(base).set(auth(teacherToken)).send({ tenantId: TENANT }).expect(403);
  });

  it('starts a promotion in REQUESTED with a step checklist', async () => {
    const res = await http()
      .post(base)
      .set(auth(adminToken))
      .send({ tenantId: TENANT, hostLabel: 'school-a / on-prem Amman', connectionRef: 'school_a' })
      .expect(201);
    expect(res.body.status).toBe('REQUESTED');
    expect(res.body.hostLabel).toBe('school-a / on-prem Amman');
    expect(res.body.steps).toHaveLength(6);
    expect(res.body.nextStep).toBe('PROVISIONED');
  });

  it('rejects skipping a step', async () => {
    await http()
      .post(`${base}/${TENANT}/advance`)
      .set(auth(adminToken))
      .send({ to: 'VERIFIED' })
      .expect(400);
  });

  it('advances through the full lifecycle to ACTIVE', async () => {
    for (const to of ['PROVISIONED', 'MIGRATED', 'DATA_COPIED', 'VERIFIED', 'ACTIVE']) {
      const res = await http()
        .post(`${base}/${TENANT}/advance`)
        .set(auth(adminToken))
        .send({ to })
        .expect(201);
      expect(res.body.status).toBe(to);
    }
    const view = await http().get(`${base}/${TENANT}`).set(auth(adminToken)).expect(200);
    expect(view.body.status).toBe('ACTIVE');
    expect(view.body.activatedAt).toBeTruthy();
    expect(view.body.steps.every((s: { done: boolean }) => s.done)).toBe(true);
  });

  it('cannot advance once ACTIVE, and cannot restart an active tenant', async () => {
    await http()
      .post(`${base}/${TENANT}/advance`)
      .set(auth(adminToken))
      .send({ to: 'ABORTED' })
      .expect(400);
    await http().post(base).set(auth(adminToken)).send({ tenantId: TENANT }).expect(409);
  });

  it('lists promotions for the platform overview', async () => {
    const res = await http().get(base).set(auth(adminToken)).expect(200);
    expect(res.body.some((r: { tenantId: string }) => r.tenantId === TENANT)).toBe(true);
  });
});

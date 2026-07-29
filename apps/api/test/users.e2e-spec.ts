/**
 * End-to-end test for tenant user administration: create (with temp password + roles), update
 * status, replace roles, reset password, and RBAC gating. Also asserts the provisioned account can
 * actually log in and that suspension blocks login.
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

const TENANT = 'da58b0a4-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PASSWORD = 'Sup3rSecret!';

describe('Users admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string;
  let teacherRoleId: string;
  let receptionistRoleId: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());

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
        data: { id: TENANT, name: 'users', slug: 'users', status: 'ACTIVE' },
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
      await mk('admin@users.example', RoleKey.SchoolAdmin);
      await mk('student@users.example', RoleKey.Student);
      const teacher = await tx.role.findFirstOrThrow({
        where: { tenantId: TENANT, key: 'Teacher' },
      });
      const recept = await tx.role.findFirstOrThrow({
        where: { tenantId: TENANT, key: 'Receptionist' },
      });
      teacherRoleId = teacher.id;
      receptionistRoleId = recept.id;
    });

    adminToken = await login('admin@users.example');
    studentToken = await login('student@users.example');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string, password = PASSWORD): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password, tenantSlug: 'users' })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('creates a user with a temp password and role, who can then log in', async () => {
    const res = await http()
      .post('/api/v1/users')
      .set(auth(adminToken))
      .send({
        email: 'reception@users.example',
        firstNameEn: 'Rana',
        roleIds: [receptionistRoleId],
      })
      .expect(201);

    expect(res.body.temporaryPassword).toEqual(expect.any(String));
    // Mail is not configured in the test environment, so the password is admin-relayed only.
    expect(res.body.emailed).toBe(false);
    expect(res.body.user.status).toBe('ACTIVE');
    expect(res.body.user.mustChangePassword).toBe(true);
    expect(res.body.user.roles.map((r: { key: string }) => r.key)).toEqual(['Receptionist']);

    // The provisioned account can authenticate with the one-time password.
    const loginRes = await http()
      .post('/api/v1/auth/login')
      .send({
        email: 'reception@users.example',
        password: res.body.temporaryPassword,
        tenantSlug: 'users',
      })
      .expect(200);
    expect(loginRes.body.accessToken).toEqual(expect.any(String));
    expect(loginRes.body.mustChangePassword).toBe(true);

    // …and resolves the Receptionist permission set.
    const me = await http().get('/api/v1/auth/me').set(auth(loginRes.body.accessToken)).expect(200);
    expect(me.body.permissions).toContain('announcement:manage');
  });

  it('creates a user with a username who can log in by username (no email)', async () => {
    const res = await http()
      .post('/api/v1/users')
      .set(auth(adminToken))
      .send({
        email: 'student1@users.example',
        username: 'Rana.H',
        roleIds: [teacherRoleId],
      })
      .expect(201);
    expect(res.body.user.username).toBe('rana.h'); // normalized lowercase

    // Log in with the username via the generic identifier field (case-insensitive).
    const loginRes = await http()
      .post('/api/v1/auth/login')
      .send({ identifier: 'RANA.H', password: res.body.temporaryPassword, tenantSlug: 'users' })
      .expect(200);
    expect(loginRes.body.accessToken).toEqual(expect.any(String));
  });

  it('rejects a duplicate username at the same school', async () => {
    await http()
      .post('/api/v1/users')
      .set(auth(adminToken))
      .send({ email: 'student2@users.example', username: 'rana.h', roleIds: [] })
      .expect(400);
  });

  it('rejects a duplicate email', async () => {
    await http()
      .post('/api/v1/users')
      .set(auth(adminToken))
      .send({ email: 'reception@users.example', roleIds: [] })
      .expect(400);
  });

  it('lists users including the new account', async () => {
    const res = await http().get('/api/v1/users').set(auth(adminToken)).expect(200);
    const emails = res.body.map((u: { email: string }) => u.email);
    expect(emails).toContain('reception@users.example');
    expect(emails).toContain('admin@users.example');
  });

  it('replaces a user’s roles', async () => {
    const list = await http().get('/api/v1/users').set(auth(adminToken)).expect(200);
    const target = list.body.find((u: { email: string }) => u.email === 'reception@users.example');
    const res = await http()
      .put(`/api/v1/users/${target.id}/roles`)
      .set(auth(adminToken))
      .send({ roleIds: [teacherRoleId] })
      .expect(200);
    expect(res.body.roles.map((r: { key: string }) => r.key)).toEqual(['Teacher']);
  });

  it('suspends a user, blocking login, then reactivates', async () => {
    const list = await http().get('/api/v1/users').set(auth(adminToken)).expect(200);
    const target = list.body.find((u: { email: string }) => u.email === 'reception@users.example');

    await http()
      .patch(`/api/v1/users/${target.id}`)
      .set(auth(adminToken))
      .send({ status: 'SUSPENDED' })
      .expect(200);

    // Reset to a known password to test the login gate deterministically.
    const reset = await http()
      .post(`/api/v1/users/${target.id}/reset-password`)
      .set(auth(adminToken))
      .expect(201);
    await http()
      .post('/api/v1/auth/login')
      .send({
        email: 'reception@users.example',
        password: reset.body.temporaryPassword,
        tenantSlug: 'users',
      })
      .expect(403);

    await http()
      .patch(`/api/v1/users/${target.id}`)
      .set(auth(adminToken))
      .send({ status: 'ACTIVE' })
      .expect(200);
    await http()
      .post('/api/v1/auth/login')
      .send({
        email: 'reception@users.example',
        password: reset.body.temporaryPassword,
        tenantSlug: 'users',
      })
      .expect(200);
  });

  it('blocks a role without user:manage', async () => {
    await http().get('/api/v1/users').set(auth(studentToken)).expect(403);
    await http()
      .post('/api/v1/users')
      .set(auth(studentToken))
      .send({ email: 'x@users.example', roleIds: [] })
      .expect(403);
  });
});

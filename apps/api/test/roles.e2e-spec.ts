/**
 * End-to-end test for per-tenant role administration (list/create/update/delete + RBAC + catalog).
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

const TENANT = 'da58b0a4-9999-4999-8999-999999999999';
const PASSWORD = 'Sup3rSecret!';

describe('Roles admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string; // no role:manage

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
        data: { id: TENANT, name: 'roles', slug: 'roles', status: 'ACTIVE' },
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
      await mk('admin@roles.example', RoleKey.SchoolAdmin);
      await mk('student@roles.example', RoleKey.Student);
    });

    adminToken = await login('admin@roles.example');
    studentToken = await login('student@roles.example');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'roles' })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('lists system roles with permissions for an admin', async () => {
    const res = await http().get('/api/v1/roles').set(auth(adminToken)).expect(200);
    const keys = res.body.map((r: { key: string }) => r.key);
    expect(keys).toContain('SchoolAdmin');
    expect(keys).toContain('Receptionist');
    const receptionist = res.body.find((r: { key: string }) => r.key === 'Receptionist');
    expect(receptionist.isSystem).toBe(true);
    expect(receptionist.permissions).toContain('announcement:manage');
  });

  it('returns the permission catalog', async () => {
    const res = await http().get('/api/v1/roles/catalog').set(auth(adminToken)).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(50);
    expect(res.body[0]).toHaveProperty('category');
  });

  it('creates, updates and deletes a custom role', async () => {
    // Create: a front-desk role that can view balances but not take payment.
    const created = await http()
      .post('/api/v1/roles')
      .set(auth(adminToken))
      .send({
        nameEn: 'Front Desk',
        permissions: ['announcement:manage', 'finance:read', 'bus:manage'],
      })
      .expect(201);
    expect(created.body.isSystem).toBe(false);
    expect(created.body.key).toMatch(/^custom-front-desk/);
    expect(created.body.permissions).toEqual(
      expect.arrayContaining(['announcement:manage', 'finance:read', 'bus:manage']),
    );
    expect(created.body.permissions).not.toContain('transaction:create');
    const id = created.body.id as string;

    // Update: swap the permission set.
    const updated = await http()
      .patch(`/api/v1/roles/${id}`)
      .set(auth(adminToken))
      .send({ permissions: ['finance:read'] })
      .expect(200);
    expect(updated.body.permissions).toEqual(['finance:read']);

    // Delete (unassigned → allowed).
    await http().delete(`/api/v1/roles/${id}`).set(auth(adminToken)).expect(204);
    const after = await http().get('/api/v1/roles').set(auth(adminToken)).expect(200);
    expect(after.body.find((r: { id: string }) => r.id === id)).toBeUndefined();
  });

  it('ignores unknown permission keys when creating a role', async () => {
    const created = await http()
      .post('/api/v1/roles')
      .set(auth(adminToken))
      .send({ nameEn: 'Bogus', permissions: ['finance:read', 'not:a:real:permission'] })
      .expect(201);
    expect(created.body.permissions).toEqual(['finance:read']);
    await http().delete(`/api/v1/roles/${created.body.id}`).set(auth(adminToken)).expect(204);
  });

  it('refuses to delete a system role', async () => {
    const roles = await http().get('/api/v1/roles').set(auth(adminToken)).expect(200);
    const teacher = roles.body.find((r: { key: string }) => r.key === 'Teacher');
    await http().delete(`/api/v1/roles/${teacher.id}`).set(auth(adminToken)).expect(400);
  });

  it('blocks a role without role:manage', async () => {
    await http().get('/api/v1/roles').set(auth(studentToken)).expect(403);
  });
});

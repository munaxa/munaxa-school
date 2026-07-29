/**
 * End-to-end tests for HR Phase 7 (asset management): the asset register, the assign→return custody
 * lifecycle (with status transitions), the employee custody view, guards, and RBAC.
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

const TENANT = '77777777-7777-7777-7777-777777777777';
const PASSWORD = 'Sup3rSecret!';

describe('HR asset management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let teacherToken: string; // no asset perms
  let employeeId: string;

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
        data: { id: TENANT, name: 'hrast', slug: 'hrast', status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT);
      for (const [email, role] of [
        ['admin@hrast.example', RoleKey.SchoolAdmin],
        ['teacher@hrast.example', RoleKey.Teacher],
      ] as const) {
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
      }
    });

    adminToken = await login('admin@hrast.example');
    teacherToken = await login('teacher@hrast.example');

    const emp = await http()
      .post('/api/v1/employees')
      .set(auth(adminToken))
      .send({
        firstNameEn: 'Sara',
        lastNameEn: 'Nasser',
        firstNameAr: 'سارة',
        lastNameAr: 'ناصر',
        jobTitle: 'Teacher',
      })
      .expect(201);
    employeeId = emp.body.id;
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.deleteMany({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'hrast' })
      .expect(200);
    return res.body.accessToken as string;
  }

  let assetId: string;

  it('registers an asset (AVAILABLE by default)', async () => {
    const asset = await http()
      .post('/api/v1/hr/assets')
      .set(auth(adminToken))
      .send({ assetTag: 'LAP-001', name: 'ThinkPad X1', category: 'LAPTOP', purchaseCost: 1200 })
      .expect(201);
    assetId = asset.body.id;
    expect(asset.body.status).toBe('AVAILABLE');
  });

  it('assigns the asset, flipping it to ASSIGNED with a current assignee', async () => {
    const assignment = await http()
      .post(`/api/v1/hr/assets/${assetId}/assign`)
      .set(auth(adminToken))
      .send({ employeeId, dueDate: '2026-12-31', note: 'Issued for term' })
      .expect(201);
    expect(assignment.body.returnedAt).toBeNull();

    const asset = await http()
      .get(`/api/v1/hr/assets/${assetId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(asset.body.status).toBe('ASSIGNED');
    expect(asset.body.currentAssignee.id).toBe(employeeId);
    expect(asset.body.assignments).toHaveLength(1);
  });

  it('rejects assigning an already-assigned asset and deleting it while assigned', async () => {
    await http()
      .post(`/api/v1/hr/assets/${assetId}/assign`)
      .set(auth(adminToken))
      .send({ employeeId })
      .expect(400);
    await http().delete(`/api/v1/hr/assets/${assetId}`).set(auth(adminToken)).expect(400);
  });

  it('lists the assignment under the employee', async () => {
    const list = await http()
      .get(`/api/v1/employees/${employeeId}/assets`)
      .set(auth(adminToken))
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].asset.assetTag).toBe('LAP-001');
  });

  it('returns the asset, closing custody and applying the return condition', async () => {
    const returned = await http()
      .post(`/api/v1/hr/assets/${assetId}/return`)
      .set(auth(adminToken))
      .send({ returnCondition: 'FAIR', note: 'Minor scratches' })
      .expect(201);
    expect(returned.body.returnedAt).toBeTruthy();
    expect(returned.body.returnCondition).toBe('FAIR');

    const asset = await http()
      .get(`/api/v1/hr/assets/${assetId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(asset.body.status).toBe('AVAILABLE');
    expect(asset.body.currentAssignee).toBeNull();
    expect(asset.body.condition).toBe('FAIR');

    // Returning again fails — nothing is out.
    await http().post(`/api/v1/hr/assets/${assetId}/return`).set(auth(adminToken)).expect(400);
  });

  it('filters the register by status', async () => {
    const available = await http()
      .get('/api/v1/hr/assets?status=AVAILABLE')
      .set(auth(adminToken))
      .expect(200);
    expect(available.body.some((a: { id: string }) => a.id === assetId)).toBe(true);
    const assigned = await http()
      .get('/api/v1/hr/assets?status=ASSIGNED')
      .set(auth(adminToken))
      .expect(200);
    expect(assigned.body.some((a: { id: string }) => a.id === assetId)).toBe(false);
  });

  it('enforces RBAC', async () => {
    await http().get('/api/v1/hr/assets').set(auth(teacherToken)).expect(403);
    await http()
      .post('/api/v1/hr/assets')
      .set(auth(teacherToken))
      .send({ assetTag: 'X', name: 'Y' })
      .expect(403);
  });
});

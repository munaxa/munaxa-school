/**
 * End-to-end tests for HR Phase 4 (staff leave): leave types, balances, requests with weekend-aware
 * working-day counting, multi-level approval, balance deduction/restoration, and RBAC.
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

const TENANT = '44444444-4444-4444-4444-444444444444';
const PASSWORD = 'Sup3rSecret!';

describe('HR staff leave (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let principalToken: string; // staff-leave:read + approve, NOT manage/request
  let teacherToken: string; // no staff-leave perms
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
        data: { id: TENANT, name: 'hrlv', slug: 'hrlv', status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT);
      for (const [email, role] of [
        ['admin@hrlv.example', RoleKey.SchoolAdmin],
        ['principal@hrlv.example', RoleKey.Principal],
        ['teacher@hrlv.example', RoleKey.Teacher],
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

    adminToken = await login('admin@hrlv.example');
    principalToken = await login('principal@hrlv.example');
    teacherToken = await login('teacher@hrlv.example');

    const emp = await http()
      .post('/api/v1/employees')
      .set(auth(adminToken))
      .send({
        firstNameEn: 'Rami',
        lastNameEn: 'Saleh',
        firstNameAr: 'رامي',
        lastNameAr: 'صالح',
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
      .send({ email, password: PASSWORD, tenantSlug: 'hrlv' })
      .expect(200);
    return res.body.accessToken as string;
  }

  let annualTypeId: string;
  let twoLevelTypeId: string;

  it('creates leave types and sets a balance', async () => {
    const annual = await http()
      .post('/api/v1/hr/leave-types')
      .set(auth(adminToken))
      .send({ name: 'Annual', paid: true, defaultAnnualDays: 21, approvalLevels: 1 })
      .expect(201);
    annualTypeId = annual.body.id;

    const twoLevel = await http()
      .post('/api/v1/hr/leave-types')
      .set(auth(adminToken))
      .send({ name: 'Special', approvalLevels: 2 })
      .expect(201);
    twoLevelTypeId = twoLevel.body.id;

    await http()
      .post(`/api/v1/employees/${employeeId}/leave-balances`)
      .set(auth(adminToken))
      .send({ leaveTypeId: annualTypeId, year: 2026, entitledDays: 21 })
      .expect(201);
  });

  it('creates a request (weekend-aware) and approves it, deducting the balance', async () => {
    // Sun 2026-03-08 → Thu 2026-03-12 = 5 working days (no weekend inside).
    const req = await http()
      .post(`/api/v1/employees/${employeeId}/leave-requests`)
      .set(auth(adminToken))
      .send({
        leaveTypeId: annualTypeId,
        startDate: '2026-03-08',
        endDate: '2026-03-12',
        reason: 'Trip',
      })
      .expect(201);
    expect(Number(req.body.workingDays)).toBe(5);
    expect(req.body.status).toBe('PENDING');

    const approved = await http()
      .post(`/api/v1/hr/leave-requests/${req.body.id}/approve`)
      .set(auth(principalToken))
      .send({ note: 'OK' })
      .expect(201);
    expect(approved.body.status).toBe('APPROVED');

    const balances = await http()
      .get(`/api/v1/employees/${employeeId}/leave-balances`)
      .set(auth(adminToken))
      .expect(200);
    const annual = balances.body.find(
      (b: { leaveTypeId: string }) => b.leaveTypeId === annualTypeId,
    );
    expect(Number(annual.usedDays)).toBe(5);
  });

  it('honours multi-level approval', async () => {
    const req = await http()
      .post(`/api/v1/employees/${employeeId}/leave-requests`)
      .set(auth(adminToken))
      .send({ leaveTypeId: twoLevelTypeId, startDate: '2026-04-05', endDate: '2026-04-06' })
      .expect(201);
    expect(req.body.requiredLevels).toBe(2);

    // First approval advances the level but stays PENDING.
    const lvl1 = await http()
      .post(`/api/v1/hr/leave-requests/${req.body.id}/approve`)
      .set(auth(adminToken))
      .expect(201);
    expect(lvl1.body.status).toBe('PENDING');
    expect(lvl1.body.currentLevel).toBe(2);

    // Second approval finalises.
    const lvl2 = await http()
      .post(`/api/v1/hr/leave-requests/${req.body.id}/approve`)
      .set(auth(adminToken))
      .expect(201);
    expect(lvl2.body.status).toBe('APPROVED');
  });

  async function usedDays(): Promise<number> {
    const balances = await http()
      .get(`/api/v1/employees/${employeeId}/leave-balances`)
      .set(auth(adminToken))
      .expect(200);
    const annual = balances.body.find(
      (b: { leaveTypeId: string }) => b.leaveTypeId === annualTypeId,
    );
    return annual ? Number(annual.usedDays) : 0;
  }

  it('cancels an approved request and restores the balance', async () => {
    const req = await http()
      .post(`/api/v1/employees/${employeeId}/leave-requests`)
      .set(auth(adminToken))
      .send({ leaveTypeId: annualTypeId, startDate: '2026-05-10', endDate: '2026-05-11' })
      .expect(201);
    const days = Number(req.body.workingDays); // Sun+Mon = 2
    await http()
      .post(`/api/v1/hr/leave-requests/${req.body.id}/approve`)
      .set(auth(adminToken))
      .expect(201);

    const before = await usedDays();
    await http()
      .post(`/api/v1/hr/leave-requests/${req.body.id}/cancel`)
      .set(auth(adminToken))
      .expect(201);
    const after = await usedDays();
    expect(before - after).toBe(days);
  });

  it('rejects a weekend-only range and an inverted range', async () => {
    // Fri+Sat only → 0 working days.
    await http()
      .post(`/api/v1/employees/${employeeId}/leave-requests`)
      .set(auth(adminToken))
      .send({ leaveTypeId: annualTypeId, startDate: '2026-03-06', endDate: '2026-03-07' })
      .expect(400);
    await http()
      .post(`/api/v1/employees/${employeeId}/leave-requests`)
      .set(auth(adminToken))
      .send({ leaveTypeId: annualTypeId, startDate: '2026-03-12', endDate: '2026-03-08' })
      .expect(400);
  });

  it('enforces RBAC', async () => {
    // A Teacher holds no staff-leave permissions.
    await http().get('/api/v1/hr/leave-types').set(auth(teacherToken)).expect(403);
    // Principal can read/approve but not manage leave types.
    await http()
      .post('/api/v1/hr/leave-types')
      .set(auth(principalToken))
      .send({ name: 'Nope' })
      .expect(403);
    await http().get('/api/v1/hr/leave-types').set(auth(principalToken)).expect(200);
  });
});

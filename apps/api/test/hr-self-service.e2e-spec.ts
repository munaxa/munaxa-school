/**
 * End-to-end tests for HR Phase 9 (self-service & manager portal): an employee views/manages their
 * own HR data via `/me/hr`, a manager sees and approves direct reports' leave via `/me/team`, plus
 * actor→employee resolution and report-ownership authorisation.
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

const TENANT = '99999999-9999-9999-9999-999999999999';
const PASSWORD = 'Sup3rSecret!';

describe('HR self-service & manager portal (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let managerToken: string; // Principal, linked to the manager employee
  let employeeToken: string; // Teacher, linked to the report employee
  let managerUserId: string;
  let employeeUserId: string;
  let managerEmployeeId: string;
  let reportEmployeeId: string;

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
        data: { id: TENANT, name: 'hress', slug: 'hress', status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT);
      const ids: Record<string, string> = {};
      for (const [email, role] of [
        ['admin@hress.example', RoleKey.SchoolAdmin],
        ['manager@hress.example', RoleKey.Principal],
        ['teacher@hress.example', RoleKey.Teacher],
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
        ids[email] = u.id;
      }
      managerUserId = ids['manager@hress.example']!;
      employeeUserId = ids['teacher@hress.example']!;
    });

    adminToken = await login('admin@hress.example');
    managerToken = await login('manager@hress.example');
    employeeToken = await login('teacher@hress.example');

    const manager = await http()
      .post('/api/v1/employees')
      .set(auth(adminToken))
      .send({
        firstNameEn: 'Mona',
        lastNameEn: 'Aziz',
        firstNameAr: 'منى',
        lastNameAr: 'عزيز',
        jobTitle: 'Head',
      })
      .expect(201);
    managerEmployeeId = manager.body.id;

    const report = await http()
      .post('/api/v1/employees')
      .set(auth(adminToken))
      .send({
        firstNameEn: 'Kareem',
        lastNameEn: 'Fadel',
        firstNameAr: 'كريم',
        lastNameAr: 'فاضل',
        jobTitle: 'Teacher',
      })
      .expect(201);
    reportEmployeeId = report.body.id;

    // Link users to employees and set the reporting line (platform bypasses RLS).
    await withPlatform(prisma, async (tx) => {
      await tx.employee.update({
        where: { id: managerEmployeeId },
        data: { userId: managerUserId },
      });
      await tx.employee.update({
        where: { id: reportEmployeeId },
        data: { userId: employeeUserId, managerId: managerEmployeeId },
      });
    });
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.deleteMany({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'hress' })
      .expect(200);
    return res.body.accessToken as string;
  }

  let leaveTypeId: string;
  let requestId: string;

  it('resolves the acting user to their own profile', async () => {
    const res = await http().get('/api/v1/me/hr/profile').set(auth(employeeToken)).expect(200);
    expect(res.body.id).toBe(reportEmployeeId);
    expect(res.body.firstNameEn).toBe('Kareem');
    expect(res.body.manager.id).toBe(managerEmployeeId);
  });

  it('rejects self-service for a user not linked to an employee', async () => {
    // The admin account holds ess:read (SchoolAdmin = all) but is not an employee.
    await http().get('/api/v1/me/hr/profile').set(auth(adminToken)).expect(403);
  });

  it('lets an employee submit their own leave', async () => {
    const type = await http()
      .post('/api/v1/hr/leave-types')
      .set(auth(adminToken))
      .send({ name: 'Annual', paid: true, defaultAnnualDays: 21, approvalLevels: 1 })
      .expect(201);
    leaveTypeId = type.body.id;
    await http()
      .post(`/api/v1/employees/${reportEmployeeId}/leave-balances`)
      .set(auth(adminToken))
      .send({ leaveTypeId, year: 2026, entitledDays: 21 })
      .expect(201);

    const req = await http()
      .post('/api/v1/me/hr/leave-requests')
      .set(auth(employeeToken))
      .send({ leaveTypeId, startDate: '2026-09-06', endDate: '2026-09-10' })
      .expect(201);
    requestId = req.body.id;
    expect(req.body.employeeId).toBe(reportEmployeeId);
    expect(req.body.status).toBe('PENDING');
  });

  it('shows the request to the manager and lets them approve it', async () => {
    const members = await http().get('/api/v1/me/team/members').set(auth(managerToken)).expect(200);
    expect(members.body.some((m: { id: string }) => m.id === reportEmployeeId)).toBe(true);

    const pending = await http()
      .get('/api/v1/me/team/leave-requests')
      .set(auth(managerToken))
      .expect(200);
    expect(pending.body.some((r: { id: string }) => r.id === requestId)).toBe(true);

    const approved = await http()
      .post(`/api/v1/me/team/leave-requests/${requestId}/approve`)
      .set(auth(managerToken))
      .expect(201);
    expect(approved.body.status).toBe('APPROVED');

    // The employee sees the approved request in their own list.
    const mine = await http()
      .get('/api/v1/me/hr/leave-requests')
      .set(auth(employeeToken))
      .expect(200);
    expect(mine.body.find((r: { id: string }) => r.id === requestId).status).toBe('APPROVED');
  });

  it('enforces the manager/self boundaries via RBAC', async () => {
    // The teacher holds no team permissions.
    await http().get('/api/v1/me/team/members').set(auth(employeeToken)).expect(403);
    // Own-data reads work for the employee.
    await http().get('/api/v1/me/hr/attendance').set(auth(employeeToken)).expect(200);
    await http().get('/api/v1/me/hr/assets').set(auth(employeeToken)).expect(200);
    await http().get('/api/v1/me/hr/training').set(auth(employeeToken)).expect(200);
  });
});

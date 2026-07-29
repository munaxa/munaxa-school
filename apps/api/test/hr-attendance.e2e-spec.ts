/**
 * End-to-end tests for HR Phase 5 (staff attendance & payroll preparation): recording/correcting
 * daily attendance, bulk marking, the payroll-prep aggregation (present/absent/paid-vs-unpaid
 * leave/overtime/payable days), CSV export, and RBAC.
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

const TENANT = '55555555-5555-5555-5555-555555555555';
const PASSWORD = 'Sup3rSecret!';

describe('HR staff attendance & payroll prep (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let principalToken: string; // staff-attendance:read only (no manage/prepare)
  let teacherToken: string; // no staff-attendance perms
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
        data: { id: TENANT, name: 'hratt', slug: 'hratt', status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT);
      for (const [email, role] of [
        ['admin@hratt.example', RoleKey.SchoolAdmin],
        ['principal@hratt.example', RoleKey.Principal],
        ['teacher@hratt.example', RoleKey.Teacher],
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

    adminToken = await login('admin@hratt.example');
    principalToken = await login('principal@hratt.example');
    teacherToken = await login('teacher@hratt.example');

    const emp = await http()
      .post('/api/v1/employees')
      .set(auth(adminToken))
      .send({
        firstNameEn: 'Lina',
        lastNameEn: 'Odeh',
        firstNameAr: 'لينا',
        lastNameAr: 'عودة',
        jobTitle: 'Coordinator',
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
      .send({ email, password: PASSWORD, tenantSlug: 'hratt' })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('records a day and captures a correction trail when the status changes', async () => {
    await http()
      .post(`/api/v1/employees/${employeeId}/attendance`)
      .set(auth(adminToken))
      .send({ date: '2026-03-08', status: 'PRESENT', overtimeHours: 2 })
      .expect(201);

    // Correct the same day to ABSENT — previous status is captured.
    const corrected = await http()
      .post(`/api/v1/employees/${employeeId}/attendance`)
      .set(auth(adminToken))
      .send({ date: '2026-03-08', status: 'ABSENT' })
      .expect(201);
    expect(corrected.body.status).toBe('ABSENT');
    expect(corrected.body.correctedFromStatus).toBe('PRESENT');
    expect(corrected.body.correctedAt).toBeTruthy();

    // Put it back to PRESENT with overtime for the payroll assertions below.
    await http()
      .post(`/api/v1/employees/${employeeId}/attendance`)
      .set(auth(adminToken))
      .send({ date: '2026-03-08', status: 'PRESENT', overtimeHours: 2 })
      .expect(201);
  });

  it('lists an employee attendance history filtered by range', async () => {
    const res = await http()
      .get(`/api/v1/employees/${employeeId}/attendance?from=2026-03-01&to=2026-03-31`)
      .set(auth(adminToken))
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].date.slice(0, 10)).toBe('2026-03-08');
  });

  it('bulk-marks a date and shows it on the daily roster', async () => {
    const bulk = await http()
      .post('/api/v1/hr/attendance/bulk')
      .set(auth(adminToken))
      .send({ date: '2026-03-09', entries: [{ employeeId, status: 'ABSENT' }] })
      .expect(201);
    expect(bulk.body.count).toBe(1);

    const roster = await http()
      .get('/api/v1/hr/attendance?date=2026-03-09')
      .set(auth(adminToken))
      .expect(200);
    expect(roster.body).toHaveLength(1);
    expect(roster.body[0].status).toBe('ABSENT');
  });

  it('aggregates payroll prep across attendance and approved paid leave', async () => {
    // A paid leave type + approved request Tue 2026-03-10 → Wed 2026-03-11 (2 working days).
    const type = await http()
      .post('/api/v1/hr/leave-types')
      .set(auth(adminToken))
      .send({ name: 'Annual', paid: true, defaultAnnualDays: 21, approvalLevels: 1 })
      .expect(201);
    await http()
      .post(`/api/v1/employees/${employeeId}/leave-balances`)
      .set(auth(adminToken))
      .send({ leaveTypeId: type.body.id, year: 2026, entitledDays: 21 })
      .expect(201);
    const req = await http()
      .post(`/api/v1/employees/${employeeId}/leave-requests`)
      .set(auth(adminToken))
      .send({ leaveTypeId: type.body.id, startDate: '2026-03-10', endDate: '2026-03-11' })
      .expect(201);
    await http()
      .post(`/api/v1/hr/leave-requests/${req.body.id}/approve`)
      .set(auth(adminToken))
      .expect(201);

    // Range Sun 2026-03-08 → Thu 2026-03-12 = 5 working days.
    const prep = await http()
      .get('/api/v1/hr/payroll-prep?from=2026-03-08&to=2026-03-12')
      .set(auth(adminToken))
      .expect(200);
    expect(prep.body.workingDays).toBe(5);
    const row = prep.body.rows.find((r: { employeeId: string }) => r.employeeId === employeeId);
    expect(row.presentDays).toBe(1); // 2026-03-08
    expect(row.absentDays).toBe(1); // 2026-03-09
    expect(row.paidLeaveDays).toBe(2); // 2026-03-10..11
    expect(row.unpaidLeaveDays).toBe(0);
    expect(row.overtimeHours).toBe(2);
    expect(row.payableDays).toBe(4); // 5 − 1 absent − 0 unpaid
  });

  it('exports payroll prep as CSV', async () => {
    const res = await http()
      .get('/api/v1/hr/payroll-prep?from=2026-03-08&to=2026-03-12&format=csv')
      .set(auth(adminToken))
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('payroll-prep');
    expect(res.text).toContain('Payable days');
  });

  it('enforces RBAC', async () => {
    // Teacher holds no staff-attendance permissions.
    await http().get('/api/v1/hr/attendance?date=2026-03-09').set(auth(teacherToken)).expect(403);
    // Principal can read the roster but not bulk-mark or run payroll prep.
    await http().get('/api/v1/hr/attendance?date=2026-03-09').set(auth(principalToken)).expect(200);
    await http()
      .post('/api/v1/hr/attendance/bulk')
      .set(auth(principalToken))
      .send({ date: '2026-03-09', entries: [{ employeeId, status: 'PRESENT' }] })
      .expect(403);
    await http()
      .get('/api/v1/hr/payroll-prep?from=2026-03-08&to=2026-03-12')
      .set(auth(principalToken))
      .expect(403);
  });
});

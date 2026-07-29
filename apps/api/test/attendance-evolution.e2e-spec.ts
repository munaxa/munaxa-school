/**
 * End-to-end tests for the Attendance evolution program:
 *   PR-3b/4b policy + shift configuration and derivation
 *   PR-9  attendance locking (write guard)
 *   PR-10 the correction workflow (request → approve → apply, the sanctioned path past a lock)
 *   PR-11 biometric ingestion (idempotent) and processing
 *   PR-12 analytics datasets + export
 *   PR-13 payroll validation gate
 *   PR-5  HR → Academics teacher-attendance projection
 *
 * NOTE: these require a live Postgres (RLS + migrations applied). They are authored to run in a
 * TCP-connected environment; see IMPLEMENTATION_PROGRESS.md for the exact commands.
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

const TENANT = '66666666-6666-6666-6666-666666666666';
const PASSWORD = 'Sup3rSecret!';
const SLUG = 'attevo';

describe('Attendance evolution (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let teacherToken: string; // no staff-attendance permissions
  let employeeId: string;
  let shiftId: string;

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
        data: { id: TENANT, name: SLUG, slug: SLUG, status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT);
      for (const [email, role] of [
        [`admin@${SLUG}.example`, RoleKey.SchoolAdmin],
        [`teacher@${SLUG}.example`, RoleKey.Teacher],
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

    adminToken = await login(`admin@${SLUG}.example`);
    teacherToken = await login(`teacher@${SLUG}.example`);

    const emp = await http()
      .post('/api/v1/employees')
      .set(auth(adminToken))
      .send({
        firstNameEn: 'Rana',
        lastNameEn: 'Saleh',
        firstNameAr: 'رنا',
        lastNameAr: 'صالح',
        jobTitle: 'Coordinator',
        employeeNumber: 'EMP-900',
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
      .send({ email, password: PASSWORD, tenantSlug: SLUG })
      .expect(200);
    return res.body.accessToken as string;
  }

  // ---- PR-3b policy ---------------------------------------------------------
  it('exposes the built-in default policy before any is configured', async () => {
    const res = await http()
      .get('/api/v1/hr/attendance/policies/effective')
      .set(auth(adminToken))
      .expect(200);
    expect(res.body.graceMinutes).toBe(5);
    expect(res.body.absentAfterMinutes).toBe(240);
  });

  it('creates a policy and returns it as the effective configuration', async () => {
    await http()
      .post('/api/v1/hr/attendance/policies')
      .set(auth(adminToken))
      .send({ name: 'Strict', isDefault: true, graceMinutes: 0, lateAfterMinutes: 1 })
      .expect(201);

    const res = await http()
      .get('/api/v1/hr/attendance/policies/effective')
      .set(auth(adminToken))
      .expect(200);
    expect(res.body.graceMinutes).toBe(0);
  });

  // ---- PR-4b shift ----------------------------------------------------------
  it('creates a shift and assigns it to an employee', async () => {
    const shift = await http()
      .post('/api/v1/hr/shifts')
      .set(auth(adminToken))
      .send({
        name: 'Morning',
        kind: 'MORNING',
        expectedCheckIn: '08:00',
        expectedCheckOut: '16:00',
        breakMinutes: 60,
      })
      .expect(201);
    shiftId = shift.body.id;

    await http()
      .post(`/api/v1/employees/${employeeId}/shifts`)
      .set(auth(adminToken))
      .send({ shiftId, effectiveFrom: '2026-03-01' })
      .expect(201);

    const list = await http()
      .get(`/api/v1/employees/${employeeId}/shifts`)
      .set(auth(adminToken))
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects a shift whose check-out is not after check-in', async () => {
    await http()
      .post('/api/v1/hr/shifts')
      .set(auth(adminToken))
      .send({ name: 'Broken', expectedCheckIn: '16:00', expectedCheckOut: '08:00' })
      .expect(400);
  });

  // ---- PR-11 biometric ------------------------------------------------------
  it('ingests device punches idempotently and folds them into attendance', async () => {
    const payload = {
      punches: [
        {
          externalRef: 'p-1',
          externalUserRef: 'EMP-900',
          punchAt: '2026-03-02T08:20:00.000Z',
          direction: 'IN',
        },
        {
          externalRef: 'p-2',
          externalUserRef: 'EMP-900',
          punchAt: '2026-03-02T16:05:00.000Z',
          direction: 'OUT',
        },
      ],
    };

    const first = await http()
      .post('/api/v1/hr/attendance/biometric/generic-rest/punches')
      .set(auth(adminToken))
      .send(payload)
      .expect(201);
    expect(first.body.stored).toBe(2);
    expect(first.body.resolved).toBe(2);

    // Redelivery of the same batch stores nothing new (idempotent on the provider reference).
    const second = await http()
      .post('/api/v1/hr/attendance/biometric/generic-rest/punches')
      .set(auth(adminToken))
      .send(payload)
      .expect(201);
    expect(second.body.stored).toBe(0);

    const processed = await http()
      .post('/api/v1/hr/attendance/biometric/process?date=2026-03-02')
      .set(auth(adminToken))
      .expect(201);
    expect(processed.body.attendanceWritten).toBe(1);

    // 08:20 against an 08:00 shift with grace 0 ⇒ LATE by 20 minutes.
    const day = await http()
      .get(`/api/v1/employees/${employeeId}/attendance?from=2026-03-02&to=2026-03-02`)
      .set(auth(adminToken))
      .expect(200);
    expect(day.body[0].status).toBe('LATE');
    expect(day.body[0].lateMinutes).toBe(20);
    expect(day.body[0].source).toBe('BIOMETRIC');
  });

  it('rejects a malformed punch payload', async () => {
    await http()
      .post('/api/v1/hr/attendance/biometric/generic-rest/punches')
      .set(auth(adminToken))
      .send({ punches: [{ externalRef: 'x' }] })
      .expect(400);
  });

  it('rejects an unknown provider key', async () => {
    await http()
      .post('/api/v1/hr/attendance/biometric/no-such-vendor/punches')
      .set(auth(adminToken))
      .send({ punches: [] })
      .expect(400);
  });

  // ---- PR-9 locking ---------------------------------------------------------
  it('locks a period and then refuses ordinary attendance writes inside it', async () => {
    await http()
      .post('/api/v1/hr/attendance/locks')
      .set(auth(adminToken))
      .send({
        scope: 'PAYROLL',
        periodStart: '2026-03-01',
        periodEnd: '2026-03-31',
        reason: 'March payroll',
      })
      .expect(201);

    await http()
      .post(`/api/v1/employees/${employeeId}/attendance`)
      .set(auth(adminToken))
      .send({ date: '2026-03-03', status: 'PRESENT' })
      .expect(409);

    // A date outside the lock is still writable.
    await http()
      .post(`/api/v1/employees/${employeeId}/attendance`)
      .set(auth(adminToken))
      .send({ date: '2026-04-01', status: 'PRESENT' })
      .expect(201);
  });

  it('rejects a lock whose end precedes its start', async () => {
    await http()
      .post('/api/v1/hr/attendance/locks')
      .set(auth(adminToken))
      .send({ scope: 'DAY', periodStart: '2026-05-10', periodEnd: '2026-05-01' })
      .expect(400);
  });

  // ---- PR-13 payroll validation --------------------------------------------
  it('blocks payroll validation while a correction is undecided, then passes once resolved', async () => {
    // Raise a correction against the locked period.
    const created = await http()
      .post('/api/v1/hr/attendance/corrections')
      .set(auth(adminToken))
      .send({
        employeeId,
        date: '2026-03-02',
        requestedStatus: 'PRESENT',
        reason: 'Traffic incident, arrival agreed with manager',
      })
      .expect(201);
    const correctionId = created.body.id;
    expect(created.body.previousStatus).toBe('LATE');

    const blocked = await http()
      .get('/api/v1/hr/payroll-prep/validated?from=2026-03-01&to=2026-03-31')
      .set(auth(adminToken))
      .expect(200);
    expect(blocked.body.validation.valid).toBe(false);
    expect(blocked.body.validation.issues.map((i: { code: string }) => i.code)).toContain(
      'PENDING_CORRECTIONS',
    );

    // ---- PR-10: approving applies the change even though the day is locked.
    const approved = await http()
      .post(`/api/v1/hr/attendance/corrections/${correctionId}/approve`)
      .set(auth(adminToken))
      .send({ note: 'Verified' })
      .expect(201);
    expect(approved.body.status).toBe('APPLIED');

    const day = await http()
      .get(`/api/v1/employees/${employeeId}/attendance?from=2026-03-02&to=2026-03-02`)
      .set(auth(adminToken))
      .expect(200);
    expect(day.body[0].status).toBe('PRESENT');
    expect(day.body[0].correctedFromStatus).toBe('LATE');

    const passing = await http()
      .get('/api/v1/hr/payroll-prep/validated?from=2026-03-01&to=2026-03-31')
      .set(auth(adminToken))
      .expect(200);
    expect(passing.body.validation.valid).toBe(true);
  });

  it('refuses to decide an already-applied correction twice', async () => {
    const list = await http()
      .get('/api/v1/hr/attendance/corrections?status=APPLIED')
      .set(auth(adminToken))
      .expect(200);
    const applied = list.body[0];
    await http()
      .post(`/api/v1/hr/attendance/corrections/${applied.id}/approve`)
      .set(auth(adminToken))
      .send({})
      .expect(400);
  });

  // ---- PR-12 analytics ------------------------------------------------------
  it('produces analytics datasets and a CSV export', async () => {
    const res = await http()
      .get('/api/v1/hr/attendance/analytics?from=2026-03-01&to=2026-04-30')
      .set(auth(adminToken))
      .expect(200);
    expect(Array.isArray(res.body.trend)).toBe(true);
    expect(Array.isArray(res.body.departments)).toBe(true);
    expect(Array.isArray(res.body.punctuality)).toBe(true);

    const csv = await http()
      .get(
        '/api/v1/hr/attendance/analytics/punctuality/export?from=2026-03-01&to=2026-04-30&format=csv',
      )
      .set(auth(adminToken))
      .expect(200);
    expect(csv.headers['content-type']).toContain('csv');
  });

  // ---- RBAC -----------------------------------------------------------------
  it('enforces RBAC on the new surfaces', async () => {
    await http()
      .post('/api/v1/hr/attendance/locks')
      .set(auth(teacherToken))
      .send({ scope: 'DAY', periodStart: '2026-06-01', periodEnd: '2026-06-01' })
      .expect(403);

    await http()
      .post('/api/v1/hr/shifts')
      .set(auth(teacherToken))
      .send({ name: 'X', expectedCheckIn: '08:00', expectedCheckOut: '16:00' })
      .expect(403);

    await http()
      .get('/api/v1/hr/attendance/analytics?from=2026-03-01&to=2026-03-31')
      .set(auth(teacherToken))
      .expect(403);
  });
});

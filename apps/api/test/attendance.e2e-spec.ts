/**
 * End-to-end tests for the Attendance System against a real PostgreSQL. Emphasis on the
 * mandatory offline-first guarantee: re-syncing the same marks is idempotent (no duplicates),
 * plus QR marking, the dashboard summary, teacher attendance, and RBAC.
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

const TENANT = 'bbbb2222-bbbb-2222-bbbb-222222222222';
const PASSWORD = 'Sup3rSecret!';
const DATE = '2025-09-07';

describe('Attendance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentRoleToken: string;
  let sectionId: string;
  let teacherId: string;
  let studentA: { id: string; qrCode: string };
  let studentB: { id: string; qrCode: string };

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
      await tx.tenant.create({ data: { id: TENANT, name: 'att', slug: 'att', status: 'ACTIVE' } });
      await rbac.provisionTenantRoles(tx, TENANT);
      const school = await tx.school.create({
        data: { tenantId: TENANT, nameEn: 'S', nameAr: 'S' },
      });
      const campus = await tx.campus.create({
        data: { tenantId: TENANT, schoolId: school.id, nameEn: 'C', nameAr: 'C' },
      });
      const grade = await tx.grade.create({
        data: { tenantId: TENANT, campusId: campus.id, nameEn: 'G', nameAr: 'G', level: 1 },
      });
      const section = await tx.section.create({
        data: { tenantId: TENANT, gradeId: grade.id, name: 'A' },
      });
      sectionId = section.id;
      const teacher = await tx.teacher.create({
        data: {
          tenantId: TENANT,
          firstNameEn: 'T',
          lastNameEn: 'T',
          firstNameAr: 'ت',
          lastNameAr: 'ت',
        },
      });
      teacherId = teacher.id;

      const admin = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'admin@att.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT, admin.id, RoleKey.SchoolAdmin);
      const limited = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'student@att.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT, limited.id, RoleKey.Student);
    });

    adminToken = await login('admin@att.example');
    studentRoleToken = await login('student@att.example');

    studentA = await createStudent('Lina');
    studentB = await createStudent('Omar');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'att' })
      .expect(200);
    return res.body.accessToken as string;
  }

  async function createStudent(firstNameEn: string): Promise<{ id: string; qrCode: string }> {
    // The Student API is identity-only — placement is year-scoped on the Enrollment (ADR-0001).
    const res = await http()
      .post('/api/v1/students')
      .set(auth(adminToken))
      .send({ firstNameEn, lastNameEn: 'X', firstNameAr: 'س', lastNameAr: 'x' })
      .expect(201);
    // Attendance still reads the deprecated Student.sectionId shim (a Phase-B reader). Populate it
    // directly here — the read-through cache that createEnrollmentRowTx/EnrollmentChange keep in sync.
    await withPlatform(prisma, (tx) =>
      tx.student.update({ where: { id: res.body.id as string }, data: { sectionId } }),
    );
    return { id: res.body.id, qrCode: res.body.qrCode };
  }

  const bulk = (records: Array<{ studentId: string; status: string; clientRef?: string }>) =>
    http()
      .post('/api/v1/attendance/students/bulk')
      .set(auth(adminToken))
      .send({ sectionId, date: DATE, classNumber: 1, records });

  it('marks attendance in bulk', async () => {
    const res = await bulk([
      { studentId: studentA.id, status: 'PRESENT', clientRef: 'c1' },
      { studentId: studentB.id, status: 'ABSENT', clientRef: 'c2' },
    ]).expect(200);
    expect(res.body.marked).toBe(2);
  });

  it('is idempotent on re-sync (no duplicates) and applies updates', async () => {
    // Re-send the SAME marks (offline queue replay) — must not duplicate.
    await bulk([
      { studentId: studentA.id, status: 'PRESENT', clientRef: 'c1' },
      { studentId: studentB.id, status: 'LATE', clientRef: 'c2' }, // B changed ABSENT -> LATE
    ]).expect(200);

    const list = await http()
      .get(`/api/v1/attendance/students?sectionId=${sectionId}&date=${DATE}&classNumber=1`)
      .set(auth(adminToken))
      .expect(200);
    expect(list.body).toHaveLength(2); // still 2 rows, not 4
    const b = list.body.find((r: { studentId: string }) => r.studentId === studentB.id);
    expect(b.status).toBe('LATE');
  });

  it('marks attendance by QR scan', async () => {
    const res = await http()
      .post('/api/v1/attendance/students/qr')
      .set(auth(adminToken))
      .send({ qrCode: studentA.qrCode, date: DATE, classNumber: 2 })
      .expect(200);
    expect(res.body.method).toBe('QR');
    expect(res.body.status).toBe('PRESENT');
  });

  it('produces a dashboard summary', async () => {
    const res = await http()
      .get(`/api/v1/attendance/students/summary?sectionId=${sectionId}&date=${DATE}&classNumber=1`)
      .set(auth(adminToken))
      .expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.counts.PRESENT).toBe(1);
    expect(res.body.counts.LATE).toBe(1);
  });

  it('returns student attendance history (parent/student view)', async () => {
    const res = await http()
      .get(`/api/v1/attendance/students/${studentA.id}/history`)
      .set(auth(adminToken))
      .expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2); // period 1 + QR period 2
  });

  it('records teacher attendance idempotently', async () => {
    await http()
      .post('/api/v1/attendance/teachers')
      .set(auth(adminToken))
      .send({ teacherId, date: DATE, status: 'PRESENT' })
      .expect(200);
    await http()
      .post('/api/v1/attendance/teachers')
      .set(auth(adminToken))
      .send({ teacherId, date: DATE, status: 'LATE' })
      .expect(200);
    const list = await http()
      .get(`/api/v1/attendance/teachers?date=${DATE}`)
      .set(auth(adminToken))
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].status).toBe('LATE');
  });

  it('enforces permissions (Student role cannot mark attendance)', async () => {
    await bulk([{ studentId: studentA.id, status: 'PRESENT' }]);
    await http()
      .post('/api/v1/attendance/students/bulk')
      .set(auth(studentRoleToken))
      .send({
        sectionId,
        date: DATE,
        classNumber: 1,
        records: [{ studentId: studentA.id, status: 'PRESENT' }],
      })
      .expect(403);
  });

  it('lets an attendance marker (Teacher) list sections and a class roster', async () => {
    // Provision a Teacher-role login (holds attendance:create but not section/student manage).
    const passwords = app.get(PasswordService);
    const rbac = app.get(RbacService);
    const hash = await passwords.hash(PASSWORD);
    await withPlatform(prisma, async (tx) => {
      const u = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'teacher@att.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT, u.id, RoleKey.Teacher);
    });
    const teacherToken = await login('teacher@att.example');

    const sections = await http().get('/api/v1/sections').set(auth(teacherToken)).expect(200);
    expect(sections.body.map((s: { id: string }) => s.id)).toContain(sectionId);

    const roster = await http()
      .get(`/api/v1/students?sectionId=${sectionId}`)
      .set(auth(teacherToken))
      .expect(200);
    expect(roster.body.length).toBeGreaterThanOrEqual(2);

    // Still cannot CREATE sections or students.
    await http().post('/api/v1/sections').set(auth(teacherToken)).send({}).expect(403);
    await http().post('/api/v1/students').set(auth(teacherToken)).send({}).expect(403);

    // A Student role can do neither.
    await http().get('/api/v1/sections').set(auth(studentRoleToken)).expect(403);
    await http().get('/api/v1/students').set(auth(studentRoleToken)).expect(403);
  });
});

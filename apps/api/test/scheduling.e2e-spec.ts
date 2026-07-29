/**
 * End-to-end tests for the enterprise scheduling engine against a real PostgreSQL.
 *
 * Exercises the complete lifecycle as one workflow: build structure → subjects → schedule plan →
 * section timetable → classes → validate → publish, then the single source of truth serving every
 * consumer (student, parent, teacher, attendance, admin), timezone-correct current-class resolution,
 * schedule exceptions, conflict detection (teacher double-booking + section overlap), and the
 * archive / restore / delete lifecycle — plus RBAC and tenant scoping.
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

const TENANT = '5c1ed01e-0000-4000-8000-00000000e2e1';
const SLUG = 'sched-e2e';
const PASSWORD = 'Sup3rSecret!';

// Fixed Sundays inside the (very wide) academic year. Asia/Amman is UTC+3, so local Sunday 08:10 is
// 05:10Z — used to assert deterministic current-class resolution independent of the server clock.
const SUN_CLEAN = '2026-06-07';
const SUN_HOLIDAY = '2026-06-14';
const SUN_CANCEL = '2026-06-21';
const AT_IN_CLASS = '2026-06-07T05:10:00.000Z'; // local Sun 08:10 → inside class 1
const AT_BREAK = '2026-06-07T05:50:00.000Z'; // local Sun 08:50 → between class 1 and 2

describe('Scheduling engine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string;
  let parentToken: string;
  let teacherToken: string;

  // ids captured during setup
  let schoolId: string;
  let semesterId: string;
  let sectionAId: string;
  let sectionBId: string;
  let studentId: string;
  let teacherId: string;
  let mathId: string;
  let sciId: string;
  let plan1Id: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());
  const login = async (email: string) =>
    (
      await http()
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD, tenantSlug: SLUG })
        .expect(200)
    ).body.accessToken as string;

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

    const users = await withPlatform(prisma, async (tx) => {
      await tx.tenant.deleteMany({ where: { id: TENANT } });
      await tx.tenant.create({ data: { id: TENANT, name: SLUG, slug: SLUG, status: 'ACTIVE' } });
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
        return u.id;
      };
      return {
        admin: await mk('admin@sched.example', RoleKey.SchoolAdmin),
        student: await mk('student@sched.example', RoleKey.Student),
        parent: await mk('parent@sched.example', RoleKey.Parent),
        teacher: await mk('teacher@sched.example', RoleKey.Teacher),
      };
    });

    adminToken = await login('admin@sched.example');
    studentToken = await login('student@sched.example');
    parentToken = await login('parent@sched.example');
    teacherToken = await login('teacher@sched.example');

    // Structure via the real API (wide dates so "now" always falls inside the active year/semester).
    const school = await http()
      .post('/api/v1/schools')
      .set(auth(adminToken))
      .send({ nameEn: 'Amman International', nameAr: 'عمان الدولية', timezone: 'Asia/Amman' })
      .expect(201);
    schoolId = school.body.id;
    expect(school.body.timezone).toBe('Asia/Amman');

    const campus = await http()
      .post('/api/v1/campuses')
      .set(auth(adminToken))
      .send({ schoolId, nameEn: 'Main', nameAr: 'الرئيسي', isMain: true })
      .expect(201);

    const year = await http()
      .post('/api/v1/academic-years')
      .set(auth(adminToken))
      .send({
        campusId: campus.body.id,
        name: '2025/2026',
        startDate: '2020-09-01',
        endDate: '2035-06-30',
        isCurrent: true,
      })
      .expect(201);

    const semester = await http()
      .post('/api/v1/semesters')
      .set(auth(adminToken))
      .send({
        academicYearId: year.body.id,
        name: 'Full Year',
        sequence: 1,
        startDate: '2020-09-01',
        endDate: '2035-06-30',
      })
      .expect(201);
    semesterId = semester.body.id;

    const grade = await http()
      .post('/api/v1/grades')
      .set(auth(adminToken))
      .send({ campusId: campus.body.id, nameEn: 'Grade 7', nameAr: 'السابع', level: 7 })
      .expect(201);

    sectionAId = (
      await http()
        .post('/api/v1/sections')
        .set(auth(adminToken))
        .send({ gradeId: grade.body.id, name: 'A' })
        .expect(201)
    ).body.id;
    sectionBId = (
      await http()
        .post('/api/v1/sections')
        .set(auth(adminToken))
        .send({ gradeId: grade.body.id, name: 'B' })
        .expect(201)
    ).body.id;

    // Domain records linking the users to the section (student/teacher/parent inheritance backbone).
    await withPlatform(prisma, async (tx) => {
      const student = await tx.student.create({
        data: {
          tenantId: TENANT,
          userId: users.student,
          sectionId: sectionAId,
          firstNameEn: 'Sara',
          lastNameEn: 'Ali',
          firstNameAr: 'سارة',
          lastNameAr: 'علي',
          qrCode: `qr-${TENANT}`,
        },
      });
      studentId = student.id;
      const teacher = await tx.teacher.create({
        data: {
          tenantId: TENANT,
          userId: users.teacher,
          firstNameEn: 'Ahmed',
          lastNameEn: 'Omar',
          firstNameAr: 'أحمد',
          lastNameAr: 'عمر',
        },
      });
      teacherId = teacher.id;
      const parent = await tx.parent.create({
        data: {
          tenantId: TENANT,
          userId: users.parent,
          firstNameEn: 'Mona',
          lastNameEn: 'Ali',
          firstNameAr: 'منى',
          lastNameAr: 'علي',
        },
      });
      await tx.parentStudent.create({
        data: {
          tenantId: TENANT,
          parentId: parent.id,
          studentId: student.id,
          relation: 'MOTHER',
          isPrimary: true,
        },
      });
    });

    mathId = (
      await http()
        .post('/api/v1/subjects')
        .set(auth(adminToken))
        .send({ nameEn: 'Mathematics', nameAr: 'رياضيات', code: 'MATH', colorHex: '#2563eb' })
        .expect(201)
    ).body.id;
    sciId = (
      await http()
        .post('/api/v1/subjects')
        .set(auth(adminToken))
        .send({ nameEn: 'Science', nameAr: 'علوم', code: 'SCI' })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.deleteMany({ where: { id: TENANT } }));
    await app.close();
  });

  const addClass = (planId: string, body: Record<string, unknown>) =>
    http().post(`/api/v1/schedule/plans/${planId}/classes`).set(auth(adminToken)).send(body);

  it('creates a plan, adds classes, validates clean, and publishes', async () => {
    const plan = await http()
      .post('/api/v1/schedule/plans')
      .set(auth(adminToken))
      .send({ semesterId, name: 'Plan A' })
      .expect(201);
    plan1Id = plan.body.id;
    expect(plan.body.status).toBe('DRAFT');

    await addClass(plan1Id, {
      sectionId: sectionAId,
      dayOfWeek: 'SUN',
      classNumber: 1,
      startTime: '08:00',
      endTime: '08:45',
      subjectId: mathId,
      teacherId,
    }).expect(201);
    await addClass(plan1Id, {
      sectionId: sectionAId,
      dayOfWeek: 'SUN',
      classNumber: 2,
      startTime: '09:00',
      endTime: '09:45',
      subjectId: sciId,
      teacherId,
    }).expect(201);

    const validation = await http()
      .get(`/api/v1/schedule/plans/${plan1Id}/validate`)
      .set(auth(adminToken))
      .expect(200);
    expect(validation.body.canPublish).toBe(true);
    expect(validation.body.conflicts).toHaveLength(0);

    const published = await http()
      .post(`/api/v1/schedule/plans/${plan1Id}/publish`)
      .set(auth(adminToken))
      .expect(200);
    expect(published.body.status).toBe('PUBLISHED');
  });

  it('students inherit the published timetable', async () => {
    const tt = await http().get('/api/v1/me/timetable').set(auth(studentToken)).expect(200);
    const sunday = tt.body.find((d: { dayOfWeek: string }) => d.dayOfWeek === 'SUN');
    expect(sunday.classes.map((c: { subjectName: string }) => c.subjectName)).toContain(
      'Mathematics',
    );

    const live = await http()
      .get('/api/v1/me/timetable/current')
      .set(auth(studentToken))
      .expect(200);
    expect(typeof live.body.state).toBe('string');
  });

  it('parents inherit each child’s timetable', async () => {
    const tt = await http()
      .get(`/api/v1/parent/timetable?studentId=${studentId}`)
      .set(auth(parentToken))
      .expect(200);
    const sunday = tt.body.find((d: { dayOfWeek: string }) => d.dayOfWeek === 'SUN');
    expect(sunday.classes.map((c: { subjectName: string }) => c.subjectName)).toContain(
      'Mathematics',
    );

    const now = await http()
      .get(`/api/v1/parent/timetable/current?studentId=${studentId}`)
      .set(auth(parentToken))
      .expect(200);
    expect(typeof now.body.state).toBe('string');
  });

  it('teachers get a dynamically generated schedule', async () => {
    const day = await http()
      .get(`/api/v1/schedule/teacher?at=${AT_IN_CLASS}`)
      .set(auth(teacherToken))
      .expect(200);
    expect(
      day.body.classes.some(
        (c: { subjectName: string; sectionName: string }) =>
          c.subjectName === 'Mathematics' && c.sectionName === 'A',
      ),
    ).toBe(true);
    expect(day.body.live).toBeDefined();
  });

  it('resolves the current class in the school timezone (deterministic)', async () => {
    const inClass = await http()
      .get(`/api/v1/schedule/current?sectionId=${sectionAId}&at=${AT_IN_CLASS}`)
      .set(auth(adminToken))
      .expect(200);
    expect(inClass.body.state).toBe('IN_CLASS');
    expect(inClass.body.current.subjectName).toBe('Mathematics');
    expect(inClass.body.current.classNumber).toBe(1);

    const onBreak = await http()
      .get(`/api/v1/schedule/current?sectionId=${sectionAId}&at=${AT_BREAK}`)
      .set(auth(adminToken))
      .expect(200);
    expect(onBreak.body.state).toBe('BREAK');
    expect(onBreak.body.next.classNumber).toBe(2);
  });

  it('attendance derives the current class from the timetable', async () => {
    const res = await http()
      .get(`/api/v1/attendance/students/current-class?sectionId=${sectionAId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(typeof res.body.state).toBe('string');
  });

  it('applies schedule exceptions (holiday + cancellation) over the published plan', async () => {
    const normal = await http()
      .get(`/api/v1/schedule/day?sectionId=${sectionAId}&date=${SUN_CLEAN}`)
      .set(auth(adminToken))
      .expect(200);
    expect(normal.body.isHoliday).toBe(false);
    expect(normal.body.classes).toHaveLength(2);

    await http()
      .post('/api/v1/schedule/exceptions')
      .set(auth(adminToken))
      .send({ date: SUN_HOLIDAY, sectionId: sectionAId, type: 'HOLIDAY' })
      .expect(201);
    const holiday = await http()
      .get(`/api/v1/schedule/day?sectionId=${sectionAId}&date=${SUN_HOLIDAY}`)
      .set(auth(adminToken))
      .expect(200);
    expect(holiday.body.isHoliday).toBe(true);
    expect(holiday.body.classes).toHaveLength(0);

    await http()
      .post('/api/v1/schedule/exceptions')
      .set(auth(adminToken))
      .send({ date: SUN_CANCEL, sectionId: sectionAId, classNumber: 1, type: 'CANCELLATION' })
      .expect(201);
    const cancelled = await http()
      .get(`/api/v1/schedule/day?sectionId=${sectionAId}&date=${SUN_CANCEL}`)
      .set(auth(adminToken))
      .expect(200);
    expect(
      cancelled.body.classes.find((c: { classNumber: number }) => c.classNumber === 1).status,
    ).toBe('CANCELLED');
  });

  it('detects teacher double-booking and section overlap, blocking publish', async () => {
    const plan2 = (
      await http()
        .post('/api/v1/schedule/plans')
        .set(auth(adminToken))
        .send({ semesterId, name: 'Plan B' })
        .expect(201)
    ).body.id;

    // Same teacher, same time, two sections → teacher double-booking.
    await addClass(plan2, {
      sectionId: sectionAId,
      dayOfWeek: 'SUN',
      classNumber: 1,
      startTime: '08:00',
      endTime: '08:45',
      subjectId: mathId,
      teacherId,
    }).expect(201);
    await addClass(plan2, {
      sectionId: sectionBId,
      dayOfWeek: 'SUN',
      classNumber: 1,
      startTime: '08:00',
      endTime: '08:45',
      subjectId: sciId,
      teacherId,
    }).expect(201);
    // Overlapping class within one section → section overlap.
    await addClass(plan2, {
      sectionId: sectionBId,
      dayOfWeek: 'SUN',
      classNumber: 2,
      startTime: '08:30',
      endTime: '09:15',
      subjectId: mathId,
      teacherId,
    }).expect(201);

    const validation = await http()
      .get(`/api/v1/schedule/plans/${plan2}/validate`)
      .set(auth(adminToken))
      .expect(200);
    const types = validation.body.conflicts.map((c: { type: string }) => c.type);
    expect(validation.body.canPublish).toBe(false);
    expect(types).toContain('TEACHER_DOUBLE_BOOKING');
    expect(types).toContain('SECTION_OVERLAP');

    await http().post(`/api/v1/schedule/plans/${plan2}/publish`).set(auth(adminToken)).expect(409);
  });

  it('archives, restores, and deletes draft plans; refuses to delete a published plan', async () => {
    const plan3 = (
      await http()
        .post('/api/v1/schedule/plans')
        .set(auth(adminToken))
        .send({ semesterId, name: 'Plan C' })
        .expect(201)
    ).body.id;

    expect(
      (
        await http()
          .post(`/api/v1/schedule/plans/${plan3}/archive`)
          .set(auth(adminToken))
          .expect(200)
      ).body.status,
    ).toBe('ARCHIVED');
    expect(
      (
        await http()
          .post(`/api/v1/schedule/plans/${plan3}/restore`)
          .set(auth(adminToken))
          .expect(200)
      ).body.status,
    ).toBe('DRAFT');
    await http().delete(`/api/v1/schedule/plans/${plan3}`).set(auth(adminToken)).expect(200);

    // The published plan cannot be deleted.
    await http().delete(`/api/v1/schedule/plans/${plan1Id}`).set(auth(adminToken)).expect(400);
  });

  it('enforces RBAC and section scoping', async () => {
    // Student cannot manage plans.
    await http()
      .post('/api/v1/schedule/plans')
      .set(auth(studentToken))
      .send({ semesterId, name: 'Nope' })
      .expect(403);
    // Student cannot read an arbitrary section's schedule (staff-only endpoint).
    await http()
      .get(`/api/v1/schedule/section?sectionId=${sectionAId}`)
      .set(auth(studentToken))
      .expect(403);
  });

  it('manages the school timezone via settings and validates it', async () => {
    const ok = await http()
      .patch(`/api/v1/schools/${schoolId}`)
      .set(auth(adminToken))
      .send({ timezone: 'Europe/London' })
      .expect(200);
    expect(ok.body.timezone).toBe('Europe/London');
    await http()
      .patch(`/api/v1/schools/${schoolId}`)
      .set(auth(adminToken))
      .send({ timezone: 'Not/AZone' })
      .expect(400);
  });
});

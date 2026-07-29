/**
 * End-to-end tests for the Student App (Phase 12) against a real PostgreSQL: the self-scoped
 * `/me/*` surface (dashboard, homework, attendance history, timetable, resource library,
 * achievements, gamification), staff resource/achievement management, attendance-streak
 * gamification (auto-award + points/level), and RBAC / self-scoping (a student only sees their
 * own record; a non-student is rejected; resources are scope-filtered).
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

const TENANT = 'dddd2222-dddd-2222-dddd-222222222222';
const PASSWORD = 'Sup3rSecret!';

describe('Student App (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string;

  let sectionId: string;
  let otherSectionId: string;
  let studentId: string;

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
      await tx.tenant.create({ data: { id: TENANT, name: 'sa', slug: 'sa', status: 'ACTIVE' } });
      await rbac.provisionTenantRoles(tx, TENANT);

      const mkUser = async (email: string, role: RoleKey) => {
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
        return u;
      };

      await mkUser('admin@sa.example', RoleKey.SchoolAdmin);
      const studentUser = await mkUser('student@sa.example', RoleKey.Student);

      // Structure: school → campus → grade → section (+ a second section for scope tests).
      const school = await tx.school.create({
        data: { tenantId: TENANT, nameEn: 'S', nameAr: 'س' },
      });
      const campus = await tx.campus.create({
        data: { tenantId: TENANT, schoolId: school.id, nameEn: 'C', nameAr: 'ج' },
      });
      const grade = await tx.grade.create({
        data: { tenantId: TENANT, campusId: campus.id, nameEn: 'G1', nameAr: '١', level: 1 },
      });
      const section = await tx.section.create({
        data: { tenantId: TENANT, gradeId: grade.id, name: 'A' },
      });
      sectionId = section.id;
      const otherSection = await tx.section.create({
        data: { tenantId: TENANT, gradeId: grade.id, name: 'B' },
      });
      otherSectionId = otherSection.id;

      const student = await tx.student.create({
        data: {
          tenantId: TENANT,
          userId: studentUser.id,
          sectionId: section.id,
          firstNameEn: 'Sami',
          lastNameEn: 'Student',
          firstNameAr: 'سامي',
          lastNameAr: 'طالب',
          qrCode: 'sa-qr-1',
        },
      });
      studentId = student.id;

      // 5 recent PRESENT days (relative to now, so they always fall inside the 30-day window).
      for (let d = 1; d <= 5; d += 1) {
        await tx.studentAttendance.create({
          data: {
            tenantId: TENANT,
            studentId: student.id,
            sectionId: section.id,
            date: new Date(Date.now() - d * 86_400_000),
            classNumber: 0,
            status: 'PRESENT',
          },
        });
      }

      // Upcoming homework for the section.
      await tx.homework.create({
        data: {
          tenantId: TENANT,
          sectionId: section.id,
          subject: 'Math',
          title: 'Worksheet 1',
          dueDate: new Date('2026-12-01'),
        },
      });
    });

    adminToken = await login('admin@sa.example');
    studentToken = await login('student@sa.example');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'sa' })
      .expect(200);
    return res.body.accessToken as string;
  }

  // ---- Self-scoped /me surface ----------------------------------------------
  it('returns the student dashboard scoped to the signed-in student', async () => {
    const res = await http().get('/api/v1/me/dashboard').set(auth(studentToken)).expect(200);
    expect(res.body.student.id).toBe(studentId);
    expect(res.body.attendanceLast30Days.PRESENT).toBe(5); // 5 PRESENT days seeded within the window
    expect(res.body.upcomingHomework).toBe(1);
    expect(res.body.gamification).toBeDefined();
  });

  it('lists the student homework and attendance history', async () => {
    const hw = await http().get('/api/v1/me/homework').set(auth(studentToken)).expect(200);
    expect(hw.body).toHaveLength(1);
    expect(hw.body[0].title).toBe('Worksheet 1');

    const att = await http().get('/api/v1/me/attendance').set(auth(studentToken)).expect(200);
    expect(att.body).toHaveLength(5);
  });

  it('returns an empty timetable until the plan-based resolver ships', async () => {
    // Timetables are inherited from the section's PUBLISHED SchedulePlan (SCHEDULING_ENGINE_REFACTOR.md).
    const tt = await http().get('/api/v1/me/timetable').set(auth(studentToken)).expect(200);
    expect(tt.body).toEqual([]);
  });

  it('rejects /me for a non-student principal (403)', async () => {
    await http().get('/api/v1/me/dashboard').set(auth(adminToken)).expect(403);
  });

  // ---- Resource library ------------------------------------------------------
  it('scopes the resource library to the student section / grade / whole-school', async () => {
    // Whole-school link.
    await http()
      .post('/api/v1/resources')
      .set(auth(adminToken))
      .send({ title: 'Library', type: 'LINK', url: 'https://example.com/lib' })
      .expect(201);
    // Section-scoped.
    await http()
      .post('/api/v1/resources')
      .set(auth(adminToken))
      .send({ title: 'Section sheet', type: 'LINK', url: 'https://example.com/sec', sectionId })
      .expect(201);
    // Another section — must NOT be visible to this student.
    await http()
      .post('/api/v1/resources')
      .set(auth(adminToken))
      .send({
        title: 'Other section',
        type: 'LINK',
        url: 'https://example.com/other',
        sectionId: otherSectionId,
      })
      .expect(201);

    const mine = await http().get('/api/v1/me/resources').set(auth(studentToken)).expect(200);
    const titles = (mine.body as Array<{ title: string }>).map((r) => r.title).sort();
    expect(titles).toEqual(['Library', 'Section sheet']);
  });

  it('blocks students from managing resources (RBAC)', async () => {
    await http()
      .post('/api/v1/resources')
      .set(auth(studentToken))
      .send({ title: 'x', type: 'LINK', url: 'https://example.com/x' })
      .expect(403);
  });

  // ---- Gamification ----------------------------------------------------------
  it('auto-awards an attendance-streak achievement and computes points/level', async () => {
    await http()
      .post('/api/v1/achievements')
      .set(auth(adminToken))
      .send({
        key: 'streak-3',
        nameEn: 'On a roll',
        nameAr: 'متواصل',
        category: 'ATTENDANCE_STREAK',
        points: 50,
        threshold: 3,
      })
      .expect(201);

    const gami = await http().get('/api/v1/me/gamification').set(auth(studentToken)).expect(200);
    expect(gami.body.currentStreak).toBe(5);
    expect(gami.body.longestStreak).toBe(5);
    expect(gami.body.totalPresentDays).toBe(5);
    expect(gami.body.totalPoints).toBe(50);
    expect(gami.body.level).toBe(1);
    expect(gami.body.achievements).toHaveLength(1);
  });

  it('lets staff manually award a GENERAL achievement (points accumulate)', async () => {
    const created = await http()
      .post('/api/v1/achievements')
      .set(auth(adminToken))
      .send({
        key: 'star',
        nameEn: 'Star Student',
        nameAr: 'نجم',
        category: 'GENERAL',
        points: 30,
      })
      .expect(201);

    await http()
      .post(`/api/v1/achievements/${created.body.id}/award`)
      .set(auth(adminToken))
      .send({ studentId })
      .expect(200);

    const earned = await http().get('/api/v1/me/achievements').set(auth(studentToken)).expect(200);
    expect(earned.body).toHaveLength(2);

    const gami = await http().get('/api/v1/me/gamification').set(auth(studentToken)).expect(200);
    expect(gami.body.totalPoints).toBe(80);
  });

  it('rejects manually awarding an attendance achievement', async () => {
    const list = await http().get('/api/v1/achievements').set(auth(adminToken)).expect(200);
    const streak = (list.body as Array<{ id: string; key: string }>).find(
      (a) => a.key === 'streak-3',
    )!;
    await http()
      .post(`/api/v1/achievements/${streak.id}/award`)
      .set(auth(adminToken))
      .send({ studentId })
      .expect(400);
  });
});

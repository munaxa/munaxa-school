/**
 * End-to-end tests for HR Phase 6 (performance & training): performance cycles, the review
 * lifecycle (draft → submit → acknowledge), goals, the training catalog, enrolment/completion,
 * the expiring-certifications report, and RBAC.
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

describe('HR performance & training (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let teacherToken: string; // no performance/training perms
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
        data: { id: TENANT, name: 'hrpt', slug: 'hrpt', status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT);
      for (const [email, role] of [
        ['admin@hrpt.example', RoleKey.SchoolAdmin],
        ['teacher@hrpt.example', RoleKey.Teacher],
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

    adminToken = await login('admin@hrpt.example');
    teacherToken = await login('teacher@hrpt.example');

    const emp = await http()
      .post('/api/v1/employees')
      .set(auth(adminToken))
      .send({
        firstNameEn: 'Omar',
        lastNameEn: 'Haddad',
        firstNameAr: 'عمر',
        lastNameAr: 'حداد',
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
      .send({ email, password: PASSWORD, tenantSlug: 'hrpt' })
      .expect(200);
    return res.body.accessToken as string;
  }

  let cycleId: string;
  let reviewId: string;

  it('creates a cycle, a review, and a goal', async () => {
    const cycle = await http()
      .post('/api/v1/hr/performance-cycles')
      .set(auth(adminToken))
      .send({
        name: '2026 Annual',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'ACTIVE',
      })
      .expect(201);
    cycleId = cycle.body.id;

    const review = await http()
      .post(`/api/v1/employees/${employeeId}/performance-reviews`)
      .set(auth(adminToken))
      .send({ cycleId })
      .expect(201);
    reviewId = review.body.id;
    expect(review.body.status).toBe('DRAFT');

    const withGoal = await http()
      .post(`/api/v1/hr/performance-reviews/${reviewId}/goals`)
      .set(auth(adminToken))
      .send({ title: 'Improve classroom engagement', weight: 40, dueDate: '2026-06-30' })
      .expect(201);
    expect(withGoal.body.status).toBe('NOT_STARTED');
  });

  it('rejects a duplicate review for the same employee + cycle', async () => {
    await http()
      .post(`/api/v1/employees/${employeeId}/performance-reviews`)
      .set(auth(adminToken))
      .send({ cycleId })
      .expect(500); // unique constraint (tenantId, cycleId, employeeId)
  });

  it('drives the review lifecycle: rate → submit → acknowledge', async () => {
    await http()
      .patch(`/api/v1/hr/performance-reviews/${reviewId}`)
      .set(auth(adminToken))
      .send({
        overallRating: 4,
        summary: 'Strong year',
        strengths: 'Rapport',
        improvements: 'Docs',
      })
      .expect(200);

    const submitted = await http()
      .post(`/api/v1/hr/performance-reviews/${reviewId}/submit`)
      .set(auth(adminToken))
      .expect(201);
    expect(submitted.body.status).toBe('SUBMITTED');
    expect(submitted.body.submittedAt).toBeTruthy();

    // Cannot submit twice.
    await http()
      .post(`/api/v1/hr/performance-reviews/${reviewId}/submit`)
      .set(auth(adminToken))
      .expect(400);

    const ack = await http()
      .post(`/api/v1/hr/performance-reviews/${reviewId}/acknowledge`)
      .set(auth(adminToken))
      .expect(201);
    expect(ack.body.status).toBe('ACKNOWLEDGED');

    // An acknowledged review can no longer be edited.
    await http()
      .patch(`/api/v1/hr/performance-reviews/${reviewId}`)
      .set(auth(adminToken))
      .send({ overallRating: 5 })
      .expect(400);
  });

  it('runs a training course through enrolment, completion and expiry reporting', async () => {
    const course = await http()
      .post('/api/v1/hr/training-courses')
      .set(auth(adminToken))
      .send({ title: 'Child Safeguarding', mandatory: true, hours: 3 })
      .expect(201);

    const record = await http()
      .post(`/api/v1/employees/${employeeId}/training-records`)
      .set(auth(adminToken))
      .send({ courseId: course.body.id })
      .expect(201);
    expect(record.body.status).toBe('ENROLLED');

    // Complete it with a soon-to-expire certification.
    const soon = new Date();
    soon.setUTCDate(soon.getUTCDate() + 30);
    const completed = await http()
      .patch(`/api/v1/hr/training-records/${record.body.id}`)
      .set(auth(adminToken))
      .send({ status: 'COMPLETED', score: 95, expiresAt: soon.toISOString().slice(0, 10) })
      .expect(200);
    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.completedAt).toBeTruthy();

    // The expiring-within-90-days report includes it.
    const expiring = await http()
      .get('/api/v1/hr/training-records/expiring?within=90')
      .set(auth(adminToken))
      .expect(200);
    expect(expiring.body.some((r: { id: string }) => r.id === record.body.id)).toBe(true);
  });

  it('enforces RBAC', async () => {
    await http().get('/api/v1/hr/performance-cycles').set(auth(teacherToken)).expect(403);
    await http().get('/api/v1/hr/training-courses').set(auth(teacherToken)).expect(403);
    await http()
      .post('/api/v1/hr/training-courses')
      .set(auth(teacherToken))
      .send({ title: 'Nope' })
      .expect(403);
  });
});

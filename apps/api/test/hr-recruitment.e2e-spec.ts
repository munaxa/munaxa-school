/**
 * End-to-end tests for HR Phase 8 (recruitment): job postings, applicants, interviews, the hire
 * flow that creates a real Employee (status HIRED, closing the Phase-1 lifecycle loop), guards, and
 * RBAC.
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

const TENANT = '88888888-8888-8888-8888-888888888888';
const PASSWORD = 'Sup3rSecret!';

describe('HR recruitment (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let teacherToken: string; // no recruitment perms

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
        data: { id: TENANT, name: 'hrrec', slug: 'hrrec', status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT);
      for (const [email, role] of [
        ['admin@hrrec.example', RoleKey.SchoolAdmin],
        ['teacher@hrrec.example', RoleKey.Teacher],
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

    adminToken = await login('admin@hrrec.example');
    teacherToken = await login('teacher@hrrec.example');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.deleteMany({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'hrrec' })
      .expect(200);
    return res.body.accessToken as string;
  }

  let postingId: string;
  let applicantId: string;

  it('creates an open posting and an applicant', async () => {
    const posting = await http()
      .post('/api/v1/hr/job-postings')
      .set(auth(adminToken))
      .send({ title: 'Math Teacher', status: 'OPEN', headcount: 1, employmentType: 'FULL_TIME' })
      .expect(201);
    postingId = posting.body.id;
    expect(posting.body.status).toBe('OPEN');
    expect(posting.body.openedAt).toBeTruthy();

    const applicant = await http()
      .post(`/api/v1/hr/job-postings/${postingId}/applicants`)
      .set(auth(adminToken))
      .send({ firstName: 'Yousef', lastName: 'Khalil', email: 'yousef@example.com' })
      .expect(201);
    applicantId = applicant.body.id;
    expect(applicant.body.status).toBe('APPLIED');
  });

  it('schedules an interview and records the outcome', async () => {
    const interview = await http()
      .post(`/api/v1/hr/applicants/${applicantId}/interviews`)
      .set(auth(adminToken))
      .send({ scheduledAt: '2026-08-01T10:00:00.000Z', mode: 'VIDEO', stage: 'First round' })
      .expect(201);
    expect(interview.body.outcome).toBe('PENDING');

    const updated = await http()
      .patch(`/api/v1/hr/interviews/${interview.body.id}`)
      .set(auth(adminToken))
      .send({ outcome: 'PASSED', rating: 5, feedback: 'Excellent' })
      .expect(200);
    expect(updated.body.outcome).toBe('PASSED');
  });

  it('advances the applicant through the pipeline', async () => {
    const updated = await http()
      .patch(`/api/v1/hr/applicants/${applicantId}`)
      .set(auth(adminToken))
      .send({ status: 'OFFER', rating: 5 })
      .expect(200);
    expect(updated.body.status).toBe('OFFER');
  });

  it('hires the applicant, creating a real Employee at status HIRED', async () => {
    const hired = await http()
      .post(`/api/v1/hr/applicants/${applicantId}/hire`)
      .set(auth(adminToken))
      .send({ firstNameAr: 'يوسف', lastNameAr: 'خليل', jobTitle: 'Math Teacher' })
      .expect(201);
    expect(hired.body.status).toBe('HIRED');
    expect(hired.body.hiredEmployeeId).toBeTruthy();

    // The created employee exists at status HIRED with the applicant's English name.
    const emp = await http()
      .get(`/api/v1/employees/${hired.body.hiredEmployeeId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(emp.body.status).toBe('HIRED');
    expect(emp.body.firstNameEn).toBe('Yousef');
    expect(emp.body.lastNameEn).toBe('Khalil');

    // Hiring twice is rejected.
    await http()
      .post(`/api/v1/hr/applicants/${applicantId}/hire`)
      .set(auth(adminToken))
      .send({ firstNameAr: 'يوسف', lastNameAr: 'خليل' })
      .expect(400);
  });

  it('enforces RBAC', async () => {
    await http().get('/api/v1/hr/job-postings').set(auth(teacherToken)).expect(403);
    await http()
      .post('/api/v1/hr/job-postings')
      .set(auth(teacherToken))
      .send({ title: 'Nope' })
      .expect(403);
  });
});

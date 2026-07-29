/**
 * End-to-end tests for Academics against a real PostgreSQL: homework (+ S3 attachment
 * presign/confirm), behavior logs, the grade import engine (idempotent) + report
 * (parent/student view), and RBAC.
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

const TENANT = 'cccc3333-cccc-3333-cccc-333333333333';
const PASSWORD = 'Sup3rSecret!';

describe('Academics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let parentToken: string;
  let sectionId: string;
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
      await tx.tenant.create({ data: { id: TENANT, name: 'ac', slug: 'ac', status: 'ACTIVE' } });
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
      const student = await tx.student.create({
        data: {
          tenantId: TENANT,
          firstNameEn: 'Lina',
          lastNameEn: 'H',
          firstNameAr: 'لينا',
          lastNameAr: 'ح',
          sectionId,
          qrCode: `QR-${TENANT}`,
        },
      });
      studentId = student.id;

      const admin = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'admin@ac.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT, admin.id, RoleKey.SchoolAdmin);
      const parent = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'parent@ac.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT, parent.id, RoleKey.Parent);
    });

    adminToken = await login('admin@ac.example');
    parentToken = await login('parent@ac.example');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'ac' })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('creates homework and presigns + confirms an attachment', async () => {
    const hw = await http()
      .post('/api/v1/homework')
      .set(auth(adminToken))
      .send({ sectionId, subject: 'Math', title: 'Ch3', dueDate: '2025-09-14' })
      .expect(201);

    const presign = await http()
      .post(`/api/v1/homework/${hw.body.id}/attachments/presign`)
      .set(auth(adminToken))
      .send({ fileName: 'work.pdf', contentType: 'application/pdf', size: 1024 })
      .expect(200);
    expect(presign.body.uploadUrl).toContain(presign.body.fileKey);

    await http()
      .post(`/api/v1/homework/${hw.body.id}/attachments`)
      .set(auth(adminToken))
      .send({
        fileName: 'work.pdf',
        fileKey: presign.body.fileKey,
        contentType: 'application/pdf',
        size: 1024,
      })
      .expect(201);

    const attachments = await http()
      .get(`/api/v1/homework/${hw.body.id}/attachments`)
      .set(auth(adminToken))
      .expect(200);
    expect(attachments.body).toHaveLength(1);
    expect(attachments.body[0].downloadUrl).toBeDefined();
  });

  it('records a behavior log and a Parent can read it', async () => {
    await http()
      .post('/api/v1/behavior')
      .set(auth(adminToken))
      .send({ studentId, type: 'POSITIVE', title: 'Helped a peer', points: 5, date: '2025-09-07' })
      .expect(201);

    const list = await http()
      .get(`/api/v1/behavior?studentId=${studentId}`)
      .set(auth(parentToken)) // Parent has behavior:read
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].type).toBe('POSITIVE');
  });

  it('imports grades from CSV idempotently and builds a report', async () => {
    const csv = [
      'studentId,subject,assessment,score,maxScore',
      `${studentId},Math,Midterm,80,100`,
      `${studentId},Math,Quiz1,18,20`,
      `${studentId},Science,Midterm,45,50`,
      `,Bad,Row,1,10`,
    ].join('\n');

    const first = await http()
      .post('/api/v1/grade-records/import')
      .set(auth(adminToken))
      .send({ csv })
      .expect(201);
    expect(first.body.imported).toBe(3);
    expect(first.body.failed).toHaveLength(1);

    // Re-import with an updated score → idempotent (no duplicate), value updated.
    const csv2 = [
      'studentId,subject,assessment,score,maxScore',
      `${studentId},Math,Midterm,90,100`,
    ].join('\n');
    await http()
      .post('/api/v1/grade-records/import')
      .set(auth(adminToken))
      .send({ csv: csv2 })
      .expect(201);

    const grades = await http()
      .get(`/api/v1/grade-records?studentId=${studentId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(grades.body).toHaveLength(3); // still 3, not 4

    const report = await http()
      .get(`/api/v1/grade-records/students/${studentId}/report`)
      .set(auth(parentToken)) // Parent has grade:read
      .expect(200);
    const math = report.body.subjects.find((s: { subject: string }) => s.subject === 'Math');
    // Math: Midterm 90/100 = 90%, Quiz1 18/20 = 90% → avg 90
    expect(math.averagePercent).toBe(90);
    expect(report.body.overallPercent).toBe(90); // Math 90, Science 90
  });

  it('enforces permissions (Parent cannot create homework)', async () => {
    await http()
      .post('/api/v1/homework')
      .set(auth(parentToken))
      .send({ sectionId, subject: 'Math', title: 'X', dueDate: '2025-09-14' })
      .expect(403);
  });
});

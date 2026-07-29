/**
 * End-to-end tests for Reporting (Phase 13) against a real PostgreSQL: attendance / academic /
 * financial / behavior summary reports, CSV / Excel / PDF export, and RBAC (report:read vs
 * report:export).
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

const TENANT = 'eeee3333-eeee-3333-eeee-333333333333';
const PASSWORD = 'Sup3rSecret!';

describe('Reporting (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let teacherToken: string; // report:read but NOT report:export
  let secretaryToken: string; // neither

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
      await tx.tenant.create({ data: { id: TENANT, name: 'rep', slug: 'rep', status: 'ACTIVE' } });
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
      await mkUser('admin@rep.example', RoleKey.SchoolAdmin);
      await mkUser('teacher@rep.example', RoleKey.Teacher);
      await mkUser('secretary@rep.example', RoleKey.Secretary);

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

      const student = await tx.student.create({
        data: {
          tenantId: TENANT,
          sectionId: section.id,
          firstNameEn: 'Rana',
          lastNameEn: 'Reports',
          firstNameAr: 'رنا',
          lastNameAr: 'تقارير',
          qrCode: 'rep-qr-1',
        },
      });
      studentId = student.id;

      // Attendance: 3 present, 1 absent.
      for (let d = 1; d <= 4; d += 1) {
        await tx.studentAttendance.create({
          data: {
            tenantId: TENANT,
            studentId: student.id,
            sectionId: section.id,
            date: new Date(`2026-03-0${d}`),
            classNumber: 0,
            status: d === 4 ? 'ABSENT' : 'PRESENT',
          },
        });
      }

      // Grades: 80/100 and 90/100 → average 85%.
      await tx.gradeRecord.createMany({
        data: [
          {
            tenantId: TENANT,
            studentId: student.id,
            sectionId: section.id,
            subject: 'Math',
            assessment: 'Quiz 1',
            score: 80,
            maxScore: 100,
          },
          {
            tenantId: TENANT,
            studentId: student.id,
            sectionId: section.id,
            subject: 'Math',
            assessment: 'Quiz 2',
            score: 90,
            maxScore: 100,
          },
        ],
      });

      // Finance: charged 100.000, paid (verified) 30.000 → outstanding 70.000.
      const repAccount = await tx.studentFinancialAccount.create({
        data: { tenantId: TENANT, studentId: student.id },
      });
      await tx.charge.create({
        data: {
          tenantId: TENANT,
          accountId: repAccount.id,
          studentId: student.id,
          description: 'Term fee',
          amount: '100.000',
          status: 'PENDING',
        },
      });
      await tx.payment.create({
        data: {
          tenantId: TENANT,
          accountId: repAccount.id,
          studentId: student.id,
          amount: '30.000',
          method: 'CASH',
          status: 'VERIFIED',
        },
      });

      // Behavior: 2 positive (+10), 1 negative (-5) → net +5.
      await tx.behaviorLog.createMany({
        data: [
          {
            tenantId: TENANT,
            studentId: student.id,
            type: 'POSITIVE',
            title: 'Helpful',
            points: 5,
            date: new Date('2026-03-01'),
          },
          {
            tenantId: TENANT,
            studentId: student.id,
            type: 'POSITIVE',
            title: 'Tidy',
            points: 5,
            date: new Date('2026-03-02'),
          },
          {
            tenantId: TENANT,
            studentId: student.id,
            type: 'NEGATIVE',
            title: 'Late',
            points: -5,
            date: new Date('2026-03-03'),
          },
        ],
      });
    });

    adminToken = await login('admin@rep.example');
    teacherToken = await login('teacher@rep.example');
    secretaryToken = await login('secretary@rep.example');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'rep' })
      .expect(200);
    return res.body.accessToken as string;
  }

  const rowFor = (body: { rows: Array<Record<string, unknown>> }) =>
    body.rows.find((r) => r.studentId === studentId)!;

  // Collect a binary response body into a Buffer (superagent has no default binary parser).
  const binaryParser = (
    res: NodeJS.ReadableStream,
    cb: (err: Error | null, body: Buffer) => void,
  ) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  };

  it('computes the attendance report', async () => {
    const res = await http().get('/api/v1/reports/attendance').set(auth(adminToken)).expect(200);
    const row = rowFor(res.body);
    expect(row.present).toBe(3);
    expect(row.absent).toBe(1);
    expect(row.total).toBe(4);
    expect(row.attendanceRate).toBe('75%');
  });

  it('computes the academic report (average %)', async () => {
    const res = await http().get('/api/v1/reports/academic').set(auth(adminToken)).expect(200);
    const row = rowFor(res.body);
    expect(row.assessments).toBe(2);
    expect(row.averagePercent).toBe('85%');
  });

  it('computes the financial report (outstanding)', async () => {
    const res = await http().get('/api/v1/reports/financial').set(auth(adminToken)).expect(200);
    const row = rowFor(res.body);
    expect(row.charged).toBe('100.000');
    expect(row.paid).toBe('30.000');
    expect(row.outstanding).toBe('70.000');
  });

  it('computes the behavior report (net points)', async () => {
    const res = await http().get('/api/v1/reports/behavior').set(auth(adminToken)).expect(200);
    const row = rowFor(res.body);
    expect(row.positive).toBe(2);
    expect(row.negative).toBe(1);
    expect(row.netPoints).toBe(5);
  });

  it('exports CSV with a download disposition', async () => {
    const res = await http()
      .get('/api/v1/reports/attendance/export?format=csv')
      .set(auth(adminToken))
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attendance-report');
    expect(res.text).toContain('Student');
    expect(res.text).toContain('Attendance %');
  });

  it('exports Excel and PDF with the right content types and magic bytes', async () => {
    const xlsx = await http()
      .get('/api/v1/reports/financial/export?format=xlsx')
      .set(auth(adminToken))
      .buffer()
      .parse(binaryParser as never)
      .expect(200);
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');
    expect((xlsx.body as Buffer).subarray(0, 2).toString('latin1')).toBe('PK'); // zip/xlsx

    const pdf = await http()
      .get('/api/v1/reports/behavior/export?format=pdf')
      .set(auth(adminToken))
      .buffer()
      .parse(binaryParser as never)
      .expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('rejects an unknown export format (400)', async () => {
    await http()
      .get('/api/v1/reports/attendance/export?format=docx')
      .set(auth(adminToken))
      .expect(400);
  });

  it('enforces RBAC: teacher can read but not export; secretary cannot read', async () => {
    await http().get('/api/v1/reports/attendance').set(auth(teacherToken)).expect(200);
    await http()
      .get('/api/v1/reports/attendance/export?format=csv')
      .set(auth(teacherToken))
      .expect(403);
    await http().get('/api/v1/reports/attendance').set(auth(secretaryToken)).expect(403);
  });
});

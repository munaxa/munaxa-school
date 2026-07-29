/**
 * End-to-end tests for School Structure Management against a real PostgreSQL.
 * Covers the full create chain, RBAC permission enforcement, and tenant isolation.
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

const TENANT_A = '66666666-6666-6666-6666-666666666666';
const TENANT_B = '77777777-7777-7777-7777-777777777777';
const PASSWORD = 'Sup3rSecret!';

describe('School structure (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAToken: string;
  let studentAToken: string;
  let adminBToken: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
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
      for (const { id, slug } of [
        { id: TENANT_A, slug: 'struct-a' },
        { id: TENANT_B, slug: 'struct-b' },
      ]) {
        await tx.tenant.deleteMany({ where: { id } });
        await tx.tenant.create({ data: { id, name: slug, slug, status: 'ACTIVE' } });
        await rbac.provisionTenantRoles(tx, id);
      }
      const adminA = await tx.user.create({
        data: {
          tenantId: TENANT_A,
          email: 'admin@struct-a.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT_A, adminA.id, RoleKey.SchoolAdmin);
      const studentA = await tx.user.create({
        data: {
          tenantId: TENANT_A,
          email: 'student@struct-a.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT_A, studentA.id, RoleKey.Student);
      const adminB = await tx.user.create({
        data: {
          tenantId: TENANT_B,
          email: 'admin@struct-b.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT_B, adminB.id, RoleKey.SchoolAdmin);
    });

    adminAToken = await login('admin@struct-a.example', 'struct-a');
    studentAToken = await login('student@struct-a.example', 'struct-a');
    adminBToken = await login('admin@struct-b.example', 'struct-b');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) =>
      tx.tenant.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } }),
    );
    await app.close();
  });

  async function login(email: string, tenantSlug: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('creates a full structure chain', async () => {
    const school = await http()
      .post('/api/v1/schools')
      .set(auth(adminAToken))
      .send({ nameEn: 'Green Valley', nameAr: 'الوادي' })
      .expect(201);

    const campus = await http()
      .post('/api/v1/campuses')
      .set(auth(adminAToken))
      .send({ schoolId: school.body.id, nameEn: 'Main', nameAr: 'الرئيسي', isMain: true })
      .expect(201);

    const year = await http()
      .post('/api/v1/academic-years')
      .set(auth(adminAToken))
      .send({
        campusId: campus.body.id,
        name: '2025/2026',
        startDate: '2025-09-01',
        endDate: '2026-06-30',
        isCurrent: true,
      })
      .expect(201);

    await http()
      .post('/api/v1/semesters')
      .set(auth(adminAToken))
      .send({
        academicYearId: year.body.id,
        name: 'First',
        sequence: 1,
        startDate: '2025-09-01',
        endDate: '2026-01-15',
      })
      .expect(201);

    const grade = await http()
      .post('/api/v1/grades')
      .set(auth(adminAToken))
      .send({ campusId: campus.body.id, nameEn: 'Grade 1', nameAr: 'الأول', level: 1 })
      .expect(201);

    const classroom = await http()
      .post('/api/v1/classrooms')
      .set(auth(adminAToken))
      .send({ campusId: campus.body.id, name: 'Room 101', capacity: 30 })
      .expect(201);

    const section = await http()
      .post('/api/v1/sections')
      .set(auth(adminAToken))
      .send({ gradeId: grade.body.id, name: 'A', classroomId: classroom.body.id, capacity: 28 })
      .expect(201);
    expect(section.body.gradeId).toBe(grade.body.id);
  });

  it('rejects an invalid parent reference', async () => {
    await http()
      .post('/api/v1/campuses')
      .set(auth(adminAToken))
      .send({ schoolId: TENANT_B, nameEn: 'X', nameAr: 'X' })
      .expect(400);
  });

  it('enforces permissions (Student cannot manage schools)', async () => {
    await http()
      .post('/api/v1/schools')
      .set(auth(studentAToken))
      .send({ nameEn: 'Nope', nameAr: 'لا' })
      .expect(403);
  });

  it('requires authentication', async () => {
    await http().get('/api/v1/schools').expect(401);
  });

  it('isolates schools across tenants', async () => {
    const aList = await http().get('/api/v1/schools').set(auth(adminAToken)).expect(200);
    const bList = await http().get('/api/v1/schools').set(auth(adminBToken)).expect(200);
    expect(aList.body.length).toBeGreaterThan(0);
    expect(bList.body.length).toBe(0); // tenant B created no schools
  });
});

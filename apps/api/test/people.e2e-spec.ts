/**
 * End-to-end tests for People Management against a real PostgreSQL: students (+ QR +
 * CSV import + parent linking), parents, teaching staff (hired in HR, with subjects and section
 * assignment), employees, RBAC enforcement, and tenant isolation.
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

const TENANT_A = '88888888-8888-8888-8888-888888888888';
const TENANT_B = '99999999-9999-9999-9999-999999999999';
const PASSWORD = 'Sup3rSecret!';

describe('People management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAToken: string;
  let studentRoleToken: string;
  let adminBToken: string;
  let sectionId: string;
  let subjectId: string;

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
      for (const { id, slug } of [
        { id: TENANT_A, slug: 'people-a' },
        { id: TENANT_B, slug: 'people-b' },
      ]) {
        await tx.tenant.deleteMany({ where: { id } });
        await tx.tenant.create({ data: { id, name: slug, slug, status: 'ACTIVE' } });
        await rbac.provisionTenantRoles(tx, id);
      }
      // Structure chain for tenant A so we have a section to assign.
      const school = await tx.school.create({
        data: { tenantId: TENANT_A, nameEn: 'S', nameAr: 'S' },
      });
      const campus = await tx.campus.create({
        data: { tenantId: TENANT_A, schoolId: school.id, nameEn: 'C', nameAr: 'C' },
      });
      const grade = await tx.grade.create({
        data: { tenantId: TENANT_A, campusId: campus.id, nameEn: 'G1', nameAr: 'G1', level: 1 },
      });
      const section = await tx.section.create({
        data: { tenantId: TENANT_A, gradeId: grade.id, name: 'A' },
      });
      sectionId = section.id;
      const subject = await tx.subject.create({
        data: { tenantId: TENANT_A, nameEn: 'Mathematics', nameAr: 'الرياضيات' },
      });
      subjectId = subject.id;

      const adminA = await tx.user.create({
        data: {
          tenantId: TENANT_A,
          email: 'admin@people-a.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT_A, adminA.id, RoleKey.SchoolAdmin);
      const limited = await tx.user.create({
        data: {
          tenantId: TENANT_A,
          email: 'student@people-a.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT_A, limited.id, RoleKey.Student);
      const adminB = await tx.user.create({
        data: {
          tenantId: TENANT_B,
          email: 'admin@people-b.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT_B, adminB.id, RoleKey.SchoolAdmin);
    });

    adminAToken = await login('admin@people-a.example', 'people-a');
    studentRoleToken = await login('student@people-a.example', 'people-a');
    adminBToken = await login('admin@people-b.example', 'people-b');
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

  const newStudent = (over: Record<string, unknown> = {}) => ({
    firstNameEn: 'Lina',
    lastNameEn: 'Hadid',
    firstNameAr: 'لينا',
    lastNameAr: 'حديد',
    ...over,
  });

  it('creates a student with an auto-generated QR code', async () => {
    const res = await http()
      .post('/api/v1/students')
      .set(auth(adminAToken))
      .send(newStudent({ sectionId }))
      .expect(201);
    expect(res.body.qrCode).toMatch(/^MNX-/);

    const qr = await http()
      .get(`/api/v1/students/${res.body.id}/qr`)
      .set(auth(adminAToken))
      .expect(200);
    expect(qr.body.qrCode).toBe(res.body.qrCode);
  });

  it('stores the full name parts and searches across father/grandfather/family names', async () => {
    const created = await http()
      .post('/api/v1/students')
      .set(auth(adminAToken))
      .send(
        newStudent({
          sectionId,
          firstNameEn: 'Omar',
          fatherNameEn: 'Khalid',
          thirdNameEn: 'Sami',
          lastNameEn: 'Haddad',
          firstNameAr: 'عمر',
          fatherNameAr: 'خالد',
          thirdNameAr: 'سامي',
          lastNameAr: 'الحداد',
        }),
      )
      .expect(201);
    expect(created.body.fatherNameEn).toBe('Khalid');
    expect(created.body.thirdNameEn).toBe('Sami');

    // Search by father name.
    const byFather = await http()
      .get('/api/v1/students?search=khalid')
      .set(auth(adminAToken))
      .expect(200);
    expect(byFather.body.some((s: { id: string }) => s.id === created.body.id)).toBe(true);

    // Search by family name in Arabic.
    const byFamilyAr = await http()
      .get(`/api/v1/students?search=${encodeURIComponent('الحداد')}`)
      .set(auth(adminAToken))
      .expect(200);
    expect(byFamilyAr.body.some((s: { id: string }) => s.id === created.body.id)).toBe(true);

    // A non-matching search excludes it.
    const none = await http()
      .get('/api/v1/students?search=zzzznomatch')
      .set(auth(adminAToken))
      .expect(200);
    expect(none.body.some((s: { id: string }) => s.id === created.body.id)).toBe(false);
  });

  it('links a parent to a student', async () => {
    const student = await http()
      .post('/api/v1/students')
      .set(auth(adminAToken))
      .send(newStudent())
      .expect(201);
    const parent = await http()
      .post('/api/v1/parents')
      .set(auth(adminAToken))
      .send({
        firstNameEn: 'Sami',
        lastNameEn: 'Hadid',
        firstNameAr: 'سامي',
        lastNameAr: 'حديد',
        phone: '0790000123',
      })
      .expect(201);

    await http()
      .post(`/api/v1/students/${student.body.id}/parents`)
      .set(auth(adminAToken))
      .send({ parentId: parent.body.id, relation: 'FATHER', isPrimary: true })
      .expect(201);

    const links = await http()
      .get(`/api/v1/students/${student.body.id}/parents`)
      .set(auth(adminAToken))
      .expect(200);
    expect(links.body).toHaveLength(1);
    expect(links.body[0].relation).toBe('FATHER');
  });

  /** Hire someone as teaching staff — the only way a teacher comes into being. */
  async function hireTeacher(over: Record<string, unknown> = {}) {
    const employee = await http()
      .post('/api/v1/employees')
      .set(auth(adminAToken))
      .send({
        firstNameEn: 'Omar',
        lastNameEn: 'Z',
        firstNameAr: 'عمر',
        lastNameAr: 'ز',
        jobTitle: 'Teacher',
        isTeacher: true,
        specialization: 'Mathematics',
        subjectIds: [subjectId],
        ...over,
      })
      .expect(201);
    const teachers = await http().get('/api/v1/teachers').set(auth(adminAToken)).expect(200);
    const teacher = teachers.body.find(
      (t: { employeeId: string | null }) => t.employeeId === employee.body.id,
    );
    return { employee: employee.body, teacher };
  }

  it('has no standalone teacher endpoint — teaching staff are hired in HR', async () => {
    await http()
      .post('/api/v1/teachers')
      .set(auth(adminAToken))
      .send({ firstNameEn: 'Ghost', lastNameEn: 'T', firstNameAr: 'شبح', lastNameAr: 'ت' })
      .expect(404);
  });

  it('lists an employee marked as teaching staff, with the subjects they instruct', async () => {
    const { employee, teacher } = await hireTeacher();

    expect(employee.teacher).toBeTruthy();
    expect(teacher).toBeDefined();
    expect(teacher.specialization).toBe('Mathematics');
    // The facet mirrors the employee, staff number included — one person, one number.
    expect(teacher.employeeNumber).toBe(employee.employeeNumber);
    expect(employee.employeeNumber).toMatch(/^E-\d{4}$/);
    expect(teacher.subjects.map((s: { subject: { id: string } }) => s.subject.id)).toEqual([
      subjectId,
    ]);
  });

  it('takes a teacher off the teaching staff when HR unticks the box', async () => {
    const { employee } = await hireTeacher();

    await http()
      .patch(`/api/v1/employees/${employee.id}`)
      .set(auth(adminAToken))
      .send({ isTeacher: false })
      .expect(200);

    const teachers = await http().get('/api/v1/teachers').set(auth(adminAToken)).expect(200);
    expect(
      teachers.body.some((t: { employeeId: string | null }) => t.employeeId === employee.id),
    ).toBe(false);

    // …and HR reads the box as unticked, rather than the closed facet it keeps for history.
    const reread = await http()
      .get(`/api/v1/employees/${employee.id}`)
      .set(auth(adminAToken))
      .expect(200);
    expect(reread.body.teacher).toBeNull();
  });

  it('rejects a subject from outside the school catalogue', async () => {
    await http()
      .post('/api/v1/employees')
      .set(auth(adminAToken))
      .send({
        firstNameEn: 'Lina',
        lastNameEn: 'Q',
        firstNameAr: 'لينا',
        lastNameAr: 'ق',
        jobTitle: 'Teacher',
        isTeacher: true,
        subjectIds: ['11111111-1111-4111-8111-111111111111'],
      })
      .expect(400);
  });

  it('assigns a teacher to a section and rejects duplicates', async () => {
    const { teacher } = await hireTeacher();

    await http()
      .post(`/api/v1/teachers/${teacher.id}/sections`)
      .set(auth(adminAToken))
      .send({ sectionId, subject: 'Mathematics' })
      .expect(201);

    await http()
      .post(`/api/v1/teachers/${teacher.id}/sections`)
      .set(auth(adminAToken))
      .send({ sectionId, subject: 'Mathematics' })
      .expect(409);

    const sections = await http()
      .get(`/api/v1/teachers/${teacher.id}/sections`)
      .set(auth(adminAToken))
      .expect(200);
    expect(sections.body).toHaveLength(1);
  });

  it('creates an employee (secretary) and issues the next staff number', async () => {
    const first = await http()
      .post('/api/v1/employees')
      .set(auth(adminAToken))
      .send({
        firstNameEn: 'Rana',
        lastNameEn: 'K',
        firstNameAr: 'رنا',
        lastNameAr: 'ك',
        jobTitle: 'Secretary',
      })
      .expect(201);
    const second = await http()
      .post('/api/v1/employees')
      .set(auth(adminAToken))
      .send({
        firstNameEn: 'Yara',
        lastNameEn: 'N',
        firstNameAr: 'يارا',
        lastNameAr: 'ن',
        jobTitle: 'Librarian',
      })
      .expect(201);

    expect(first.body.employeeNumber).toMatch(/^E-\d{4}$/);
    expect(second.body.employeeNumber).toMatch(/^E-\d{4}$/);
    expect(Number(second.body.employeeNumber.slice(2))).toBe(
      Number(first.body.employeeNumber.slice(2)) + 1,
    );
  });

  it('refuses a staff number another employee already holds', async () => {
    const taken = await http()
      .post('/api/v1/employees')
      .set(auth(adminAToken))
      .send({
        firstNameEn: 'Hala',
        lastNameEn: 'S',
        firstNameAr: 'هالة',
        lastNameAr: 'س',
        jobTitle: 'Accountant',
      })
      .expect(201);

    await http()
      .post('/api/v1/employees')
      .set(auth(adminAToken))
      .send({
        firstNameEn: 'Copy',
        lastNameEn: 'Cat',
        firstNameAr: 'نسخة',
        lastNameAr: 'ق',
        jobTitle: 'Accountant',
        employeeNumber: taken.body.employeeNumber,
      })
      .expect(409);
  });

  it('bulk-imports students from CSV and reports row errors', async () => {
    const csv = [
      'firstNameEn,lastNameEn,firstNameAr,lastNameAr,moeStudentNumber',
      'Ali,Nasser,علي,ناصر,100200',
      'Maya,Saleh,مايا,صالح,100201',
      ',NoFirst,بدون,اسم,100202',
    ].join('\n');

    const res = await http()
      .post('/api/v1/students/import')
      .set(auth(adminAToken))
      .send({ csv })
      .expect(201);
    expect(res.body.created).toBe(2);
    expect(res.body.failed).toHaveLength(1);
    expect(res.body.failed[0].row).toBe(4);
  });

  it('enforces permissions (Student role cannot manage people)', async () => {
    await http()
      .post('/api/v1/students')
      .set(auth(studentRoleToken))
      .send(newStudent())
      .expect(403);
  });

  it('isolates people across tenants', async () => {
    const bList = await http().get('/api/v1/students').set(auth(adminBToken)).expect(200);
    expect(bList.body).toHaveLength(0);
    const aList = await http().get('/api/v1/students').set(auth(adminAToken)).expect(200);
    expect(aList.body.length).toBeGreaterThan(0);
  });
});

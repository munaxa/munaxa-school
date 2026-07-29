/**
 * Unified admissions write path (e2e). Verifies that EVERY new admission — single-student or
 * multi-student — creates ONE Financial Account (Payer) and a single account payment plan, and that
 * the single-student commit is the N=1 case of the account commit (no separate code path).
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

const TENANT = 'aaaa7777-aaaa-7777-aaaa-777777777777';
const PASSWORD = 'Sup3rSecret!';

describe('Unified admissions write path (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let gradeId: string;
  let academicYearId: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });
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
      await tx.tenant.create({ data: { id: TENANT, name: 'adm', slug: 'adm', status: 'ACTIVE' } });
      await rbac.provisionTenantRoles(tx, TENANT);
      const admin = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'admin@adm.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      // SchoolAdmin holds both enrollment:manage and finance permissions.
      await rbac.assignRole(tx, TENANT, admin.id, RoleKey.SchoolAdmin);

      const school = await tx.school.create({
        data: { tenantId: TENANT, nameEn: 'S', nameAr: 'س' },
      });
      const campus = await tx.campus.create({
        data: { tenantId: TENANT, schoolId: school.id, nameEn: 'Main', nameAr: 'الرئيسي' },
      });
      const ay = await tx.academicYear.create({
        data: {
          tenantId: TENANT,
          campusId: campus.id,
          name: '2026/27',
          startDate: new Date('2026-09-01'),
          endDate: new Date('2027-06-30'),
          isCurrent: true,
        },
      });
      const grade = await tx.grade.create({
        data: { tenantId: TENANT, campusId: campus.id, nameEn: 'G1', nameAr: 'ص1', level: 1 },
      });
      // A fee schedule so the quote engine has fees to price (registration + tuition).
      await tx.gradeFeeSchedule.create({
        data: {
          tenantId: TENANT,
          gradeId: grade.id,
          academicYearId: ay.id,
          registrationFee: '100.000',
          tuitionFee: '900.000',
          effectiveFrom: new Date('2026-01-01'),
        },
      });
      academicYearId = ay.id;
      gradeId = grade.id;
    });

    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'admin@adm.example', password: PASSWORD, tenantSlug: 'adm' })
      .expect(200);
    token = res.body.accessToken as string;
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function quote(): Promise<string> {
    const res = await http()
      .post('/api/v1/admissions/quote')
      .set(auth())
      .send({
        gradeId,
        academicYearId,
        paymentMode: 'INSTALLMENTS',
        installments: 9,
        firstDueDate: '2026-09-01',
        persist: true,
      })
      .expect(201);
    return res.body.quoteId as string;
  }

  it('single-student commit creates a Financial Account (Payer) + account plan (N=1)', async () => {
    const quoteId = await quote();
    const res = await http()
      .post('/api/v1/admissions/commit')
      .set(auth())
      .send({
        quoteId,
        idempotencyKey: `single-${Date.now()}`,
        student: { firstNameEn: 'Omar', lastNameEn: 'Solo', nationalId: 'S1' },
        parent: { firstNameEn: 'Dad', lastNameEn: 'Solo', phone: '0790000001' },
      })
      .expect(201);
    // Admission workflow vs. participation are now separate (Decision 2): a finalised admission is
    // REGISTERED, and its enrollment participates as ACTIVE.
    expect(res.body.admissionStatus).toBe('REGISTERED');
    expect(res.body.status).toBe('ACTIVE');
    const studentId = res.body.studentId as string;

    await withPlatform(prisma, async (tx) => {
      const sfa = await tx.studentFinancialAccount.findFirst({ where: { studentId } });
      expect(sfa?.payerId).toBeTruthy();
      const payer = await tx.payer.findFirst({ where: { id: sfa!.payerId! } });
      expect(payer?.ownerType).toBe('GUARDIAN');
      const plan = await tx.financialAccountPlan.findFirst({ where: { payerId: sfa!.payerId! } });
      expect(plan?.installments).toBe(9);
      const charges = await tx.charge.count({ where: { studentId } });
      expect(charges).toBeGreaterThan(0);
    });
  });

  it('family commit puts multiple students on ONE account with exactly N installments', async () => {
    const [q1, q2] = await Promise.all([quote(), quote()]);
    const res = await http()
      .post('/api/v1/admissions/family/commit')
      .set(auth())
      .send({
        idempotencyKey: `fam-${Date.now()}`,
        academicYearId,
        parent: { firstNameEn: 'Dad', lastNameEn: 'Fam', phone: '0790000002' },
        paymentMode: 'INSTALLMENTS',
        installments: 9,
        firstDueDate: '2026-09-01',
        students: [
          { quoteId: q1, student: { firstNameEn: 'Amir', lastNameEn: 'Fam', nationalId: 'F1' } },
          { quoteId: q2, student: { firstNameEn: 'Bana', lastNameEn: 'Fam', nationalId: 'F2' } },
        ],
      })
      .expect(201);
    expect(res.body.enrollmentIds).toHaveLength(2);
    const payerId = res.body.financialAccount.id as string;

    await withPlatform(prisma, async (tx) => {
      const linked = await tx.studentFinancialAccount.count({ where: { payerId } });
      expect(linked).toBe(2); // both children billed through the ONE account
      const plans = await tx.financialAccountPlan.count({ where: { payerId } });
      expect(plans).toBe(1); // ONE account plan
      // Each child's tuition charge has its own aligned 9-installment plan (9 family installments,
      // not 9 per student — they share due dates).
      const installments = await tx.installment.findMany({
        where: { charge: { account: { payerId }, description: 'Tuition & fees' } },
        select: { dueDate: true },
      });
      const distinctDueDates = new Set(
        installments.map((i) => i.dueDate?.toISOString().slice(0, 10)),
      );
      expect(distinctDueDates.size).toBe(9);
    });
  });
});

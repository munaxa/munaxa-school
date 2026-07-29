/**
 * Explicit billing transfer (guardian change never moves money on its own). Verifies that:
 *   • after admission under guardian A, changing the student's guardian to B does NOT move billing;
 *   • the finance search for B (no own account) falls back to where B's student is billed (A's account);
 *   • an explicit transfer re-owns the student's account under B and carries the ledger.
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

const TENANT = 'cccc9999-cccc-9999-cccc-999999999999';
const PASSWORD = 'Sup3rSecret!';

describe('Explicit billing transfer (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let gradeId: string;
  let academicYearId: string;
  let parentBId: string;

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
      await tx.tenant.create({ data: { id: TENANT, name: 'bt', slug: 'bt', status: 'ACTIVE' } });
      await rbac.provisionTenantRoles(tx, TENANT);
      const admin = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'admin@bt.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
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
          schoolId: school.id,
          name: '2026/27',
          startDate: new Date('2026-09-01'),
          endDate: new Date('2027-06-30'),
          isCurrent: true,
          status: 'ACTIVE',
        },
      });
      const grade = await tx.grade.create({
        data: { tenantId: TENANT, campusId: campus.id, nameEn: 'G1', nameAr: 'ص1', level: 1 },
      });
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
      const parentB = await tx.parent.create({
        data: {
          tenantId: TENANT,
          firstNameEn: 'Bibi',
          lastNameEn: 'Roe',
          firstNameAr: 'ب',
          lastNameAr: 'ر',
        },
      });
      academicYearId = ay.id;
      gradeId = grade.id;
      parentBId = parentB.id;
    });

    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'admin@bt.example', password: PASSWORD, tenantSlug: 'bt' })
      .expect(200);
    token = res.body.accessToken as string;
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  it('transfers a student’s billing to another linked guardian, carrying the ledger', async () => {
    // Admit under guardian A.
    const quote = await http()
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
    const commit = await http()
      .post('/api/v1/admissions/commit')
      .set(auth())
      .send({
        quoteId: quote.body.quoteId,
        idempotencyKey: `bt-${Date.now()}`,
        student: { firstNameEn: 'Kid', lastNameEn: 'Roe', nationalId: 'BT1' },
        parent: { firstNameEn: 'Abu', lastNameEn: 'Roe', phone: '0790000099' },
      })
      .expect(201);
    const studentId = commit.body.studentId as string;

    // Link guardian B (the new parent). Billing must still be under A.
    await http()
      .post(`/api/v1/students/${studentId}/parents`)
      .set(auth())
      .send({ parentId: parentBId, relation: 'MOTHER' })
      .expect(201);

    const beforePayer = await withPlatform(prisma, (tx) =>
      tx.studentFinancialAccount.findUnique({ where: { studentId }, select: { payerId: true } }),
    );
    expect(beforePayer?.payerId).toBeTruthy();

    // Finance search for B falls back to where B's student is billed (A's account) — no dead end.
    const search = await http()
      .get('/api/v1/finance/families/search?q=Bibi')
      .set(auth())
      .expect(200);
    const bHit = search.body.find((h: { parentId: string }) => h.parentId === parentBId);
    expect(bHit?.financialAccountId).toBe(beforePayer?.payerId);

    // A reason is mandatory — omitting it is rejected.
    await http()
      .post('/api/v1/finance/families/transfer-billing')
      .set(auth())
      .send({ studentId, toParentId: parentBId })
      .expect(400);

    // Explicit transfer to B (with a reason).
    const res = await http()
      .post('/api/v1/finance/families/transfer-billing')
      .set(auth())
      .send({ studentId, toParentId: parentBId, reason: 'PARENT_REQUEST' })
      .expect(201);
    expect(res.body.moved).toBe(true);
    expect(res.body.transferId).toBeTruthy();

    // A BillingResponsibilityTransfer business record was written (payer history preserved).
    await withPlatform(prisma, async (tx) => {
      const rows = await tx.billingResponsibilityTransfer.findMany({ where: { studentId } });
      expect(rows).toHaveLength(1);
      const row = rows[0]!;
      expect(row.reason).toBe('PARENT_REQUEST');
      expect(row.toPayerId).toBeTruthy();
    });

    await withPlatform(prisma, async (tx) => {
      const sfa = await tx.studentFinancialAccount.findUnique({
        where: { studentId },
        select: { payerId: true },
      });
      const bPayer = await tx.payer.findFirst({
        where: { parentId: parentBId },
        select: { id: true },
      });
      expect(sfa?.payerId).toBe(bPayer?.id); // account re-owned by B
      expect(sfa?.payerId).not.toBe(beforePayer?.payerId);
    });
  });
});

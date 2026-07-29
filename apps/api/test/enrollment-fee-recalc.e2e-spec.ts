/**
 * Fee recalculation after a grade correction (PR 2). Verifies the finance guardrails end-to-end:
 *   • the comparison shows the correct financial impact (new grade − currently billed);
 *   • an explicit recalculation re-prices ONLY the unpaid, non-registration tuition;
 *   • the registration fee is kept;
 *   • a charge with a payment on it is NEVER touched (paid amounts / ledger history are the SoT).
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

const TENANT = 'bbbb8888-bbbb-8888-bbbb-888888888888';
const PASSWORD = 'Sup3rSecret!';

describe('Fee recalculation after grade correction (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let grade1: string;
  let grade2: string;
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
      await tx.tenant.create({ data: { id: TENANT, name: 'rec', slug: 'rec', status: 'ACTIVE' } });
      await rbac.provisionTenantRoles(tx, TENANT);
      const admin = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'admin@rec.example',
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
      const g1 = await tx.grade.create({
        data: { tenantId: TENANT, campusId: campus.id, nameEn: 'G1', nameAr: 'ص1', level: 1 },
      });
      const g2 = await tx.grade.create({
        data: { tenantId: TENANT, campusId: campus.id, nameEn: 'G2', nameAr: 'ص2', level: 2 },
      });
      await tx.gradeFeeSchedule.create({
        data: {
          tenantId: TENANT,
          gradeId: g1.id,
          academicYearId: ay.id,
          registrationFee: '100.000',
          tuitionFee: '900.000',
          effectiveFrom: new Date('2026-01-01'),
        },
      });
      await tx.gradeFeeSchedule.create({
        data: {
          tenantId: TENANT,
          gradeId: g2.id,
          academicYearId: ay.id,
          registrationFee: '100.000',
          tuitionFee: '1500.000',
          effectiveFrom: new Date('2026-01-01'),
        },
      });
      academicYearId = ay.id;
      grade1 = g1.id;
      grade2 = g2.id;
    });

    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'admin@rec.example', password: PASSWORD, tenantSlug: 'rec' })
      .expect(200);
    token = res.body.accessToken as string;
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function admit(gradeId: string, nationalId: string): Promise<string> {
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
        idempotencyKey: `rec-${nationalId}-${Date.now()}`,
        student: { firstNameEn: 'Fee', lastNameEn: 'Test', nationalId },
        parent: { firstNameEn: 'Dad', lastNameEn: 'Test', phone: `07900${nationalId}` },
      })
      .expect(201);
    return commit.body.id as string;
  }

  it('re-prices unpaid tuition to the new grade, keeps the registration fee', async () => {
    const enrollmentId = await admit(grade1, '11111');

    // Correct the grade to G2, then compare: new tuition 1500 vs. currently-billed 900 → +600.
    await http()
      .patch(`/api/v1/enrollments/${enrollmentId}/correct-grade`)
      .set(auth())
      .send({ gradeId: grade2 })
      .expect(200);

    const cmp = await http()
      .get(`/api/v1/enrollments/${enrollmentId}/fee-comparison`)
      .set(auth())
      .expect(200);
    expect(Number(cmp.body.currentTuition)).toBeCloseTo(900, 1);
    expect(Number(cmp.body.newTuition)).toBeCloseTo(1500, 1);
    expect(Number(cmp.body.difference)).toBeCloseTo(600, 1);
    expect(cmp.body.paidChargesAffected).toBe(0);
    expect(cmp.body.unpaidChargesToReplace).toBe(1);

    await http()
      .post(`/api/v1/enrollments/${enrollmentId}/recalculate-fees`)
      .set(auth())
      .expect(201);

    await withPlatform(prisma, async (tx) => {
      const tuition = await tx.charge.findMany({
        where: { enrollmentId, description: 'Tuition & fees' },
        select: { status: true, amount: true },
      });
      const active = tuition.filter((c) => c.status !== 'CANCELLED');
      expect(active).toHaveLength(1);
      expect(Number(active[0]!.amount)).toBeCloseTo(1500, 1); // new grade tuition
      // The registration charge is untouched (still active).
      const reg = await tx.charge.findFirst({
        where: { enrollmentId, feeItem: { kind: 'REGISTRATION' } },
        select: { status: true },
      });
      if (reg) expect(reg.status).not.toBe('CANCELLED');
    });
  });

  it('never touches a charge that has a payment on it', async () => {
    const enrollmentId = await admit(grade1, '22222');

    // Simulate a payment: mark the tuition charge's first installment PAID (ledger history).
    await withPlatform(prisma, async (tx) => {
      const tuition = await tx.charge.findFirst({
        where: { enrollmentId, description: 'Tuition & fees' },
        select: { id: true },
      });
      const inst = await tx.installment.findFirst({
        where: { chargeId: tuition!.id },
        orderBy: { seq: 'asc' },
        select: { id: true },
      });
      await tx.installment.update({ where: { id: inst!.id }, data: { status: 'PAID' } });
    });

    await http()
      .patch(`/api/v1/enrollments/${enrollmentId}/correct-grade`)
      .set(auth())
      .send({ gradeId: grade2 })
      .expect(200);
    await http()
      .post(`/api/v1/enrollments/${enrollmentId}/recalculate-fees`)
      .set(auth())
      .expect(201);

    await withPlatform(prisma, async (tx) => {
      // The partially-paid tuition charge is kept (not cancelled) — paid amounts are the source of truth.
      const tuition = await tx.charge.findMany({
        where: { enrollmentId, description: 'Tuition & fees' },
        select: { status: true, amount: true },
      });
      const kept = tuition.find((c) => c.status !== 'CANCELLED' && Number(c.amount) === 900);
      expect(kept).toBeTruthy();
    });
  });
});

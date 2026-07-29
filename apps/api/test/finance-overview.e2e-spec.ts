/**
 * Account-centric finance overview (e2e) — the unified workspace dashboard. Validates that the
 * tenant-wide SQL aggregations run under RLS (as munaxa_app) and are keyed on the Financial Account
 * (Payer), never the student: KPIs, largest-outstanding accounts, recent payments, upcoming
 * installments.
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

const TENANT = 'eeee1111-eeee-1111-eeee-111111111111';
const PASSWORD = 'Sup3rSecret!';

describe('Finance overview dashboard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let payerId: string;

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
      await tx.tenant.create({ data: { id: TENANT, name: 'ov', slug: 'ov', status: 'ACTIVE' } });
      await rbac.provisionTenantRoles(tx, TENANT);
      const u = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'fin@ov.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT, u.id, RoleKey.FinanceOfficer);

      const student = await tx.student.create({
        data: {
          tenantId: TENANT,
          firstNameEn: 'Omar',
          lastNameEn: 'Abu Alhaj',
          firstNameAr: 'عمر',
          lastNameAr: 'ابو الحاج',
          qrCode: `QR-${TENANT}-o`,
        },
      });
      const parent = await tx.parent.create({
        data: {
          tenantId: TENANT,
          firstNameEn: 'Abu',
          lastNameEn: 'Alhaj',
          firstNameAr: 'ابو',
          lastNameAr: 'الحاج',
          phone: '+962790005555',
        },
      });
      const payer = await tx.payer.create({
        data: {
          tenantId: TENANT,
          parentId: parent.id,
          nameEn: 'Abu Alhaj Family',
          nameAr: 'عائلة',
        },
      });
      payerId = payer.id;
      const acct = await tx.studentFinancialAccount.create({
        data: { tenantId: TENANT, studentId: student.id, payerId: payer.id },
      });
      const charge = await tx.charge.create({
        data: {
          tenantId: TENANT,
          accountId: acct.id,
          studentId: student.id,
          description: 'Tuition',
          amount: '500.000',
          status: 'PENDING',
        },
      });
      await tx.paymentPlan.create({
        data: {
          tenantId: TENANT,
          chargeId: charge.id,
          cadence: 'MONTHLY',
          installments: 2,
          firstDueDate: new Date('2027-01-01'),
          status: 'ACTIVE',
        },
      });
      // One future installment (upcoming) + one already-due-unpaid (overdue).
      await tx.installment.create({
        data: {
          tenantId: TENANT,
          chargeId: charge.id,
          seq: 1,
          amount: '250.000',
          dueDate: new Date('2020-01-01'),
          status: 'SCHEDULED',
        },
      });
      await tx.installment.create({
        data: {
          tenantId: TENANT,
          chargeId: charge.id,
          seq: 2,
          amount: '250.000',
          dueDate: new Date('2099-01-01'),
          status: 'SCHEDULED',
        },
      });
      // A verified payment received today (collected today / this month + recent payments).
      await tx.payment.create({
        data: {
          tenantId: TENANT,
          payerId: payer.id,
          accountId: acct.id,
          studentId: student.id,
          accountScoped: true,
          amount: '100.000',
          method: 'CASH',
          status: 'VERIFIED',
          verifiedAt: new Date(),
        },
      });
    });

    token = (
      await http()
        .post('/api/v1/auth/login')
        .send({ email: 'fin@ov.example', password: PASSWORD, tenantSlug: 'ov' })
        .expect(200)
    ).body.accessToken as string;
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  it('returns account-centric KPIs and widgets', async () => {
    const res = await http().get('/api/v1/finance/families/dashboard').set(auth()).expect(200);
    const body = res.body as {
      kpis: Record<string, string | number>;
      largestOutstandingAccounts: Array<{ payerId: string; name: string; outstanding: string }>;
      recentPayments: Array<{ payerId: string | null; amount: string }>;
      upcomingInstallments: Array<{ payerId: string; amount: string }>;
    };

    // KPIs.
    expect(Number(body.kpis.totalOutstanding)).toBe(500); // 500 charge, no allocations yet
    expect(Number(body.kpis.collectedToday)).toBe(100);
    expect(Number(body.kpis.collectedThisMonth)).toBe(100);
    expect(Number(body.kpis.overdueAccounts)).toBe(1); // the 2020 installment is overdue
    expect(Number(body.kpis.pendingInstallments)).toBe(2);
    expect(Number(body.kpis.activePaymentPlans)).toBe(1);

    // Largest outstanding accounts — keyed on the Financial Account (Payer).
    const acc = body.largestOutstandingAccounts.find((a) => a.payerId === payerId);
    expect(acc).toBeDefined();
    expect(acc!.name).toBe('Abu Alhaj Family');
    expect(Number(acc!.outstanding)).toBe(500);

    // Recent payments + upcoming installments carry the account id (for click-through).
    expect(body.recentPayments.some((p) => p.payerId === payerId)).toBe(true);
    expect(body.upcomingInstallments.some((i) => i.payerId === payerId)).toBe(true);
  });
});

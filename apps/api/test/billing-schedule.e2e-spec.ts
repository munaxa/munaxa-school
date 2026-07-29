/**
 * Account Billing Schedule (e2e) — the dynamic read model. Two siblings billed through ONE Financial
 * Account: their installments merge into ONE schedule keyed by due date, each row expanding into
 * per-student / per-fee lines with paid/balance/status derived from the ledger (no persisted plan).
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

const TENANT = 'ffff2222-ffff-2222-ffff-222222222222';
const PASSWORD = 'Sup3rSecret!';

interface Line {
  studentName: string;
  chargeDescription: string;
  amount: string;
  paid: string;
  balance: string;
  status: string;
}
interface Row {
  dueDate: string | null;
  amount: string;
  paid: string;
  balance: string;
  status: string;
  lines: Line[];
}

describe('Account Billing Schedule (e2e)', () => {
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
      await tx.tenant.create({ data: { id: TENANT, name: 'bs', slug: 'bs', status: 'ACTIVE' } });
      await rbac.provisionTenantRoles(tx, TENANT);
      const u = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'fin@bs.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT, u.id, RoleKey.FinanceOfficer);

      const parent = await tx.parent.create({
        data: {
          tenantId: TENANT,
          firstNameEn: 'Dad',
          lastNameEn: 'Fam',
          firstNameAr: 'اب',
          lastNameAr: 'ف',
          phone: '+962790006666',
        },
      });
      const payer = await tx.payer.create({
        data: { tenantId: TENANT, parentId: parent.id, nameEn: 'The Fam', nameAr: 'ال' },
      });
      payerId = payer.id;

      const mkStudent = async (fn: string, qr: string) =>
        (
          await tx.student.create({
            data: {
              tenantId: TENANT,
              firstNameEn: fn,
              lastNameEn: 'Fam',
              firstNameAr: 'ط',
              lastNameAr: 'ف',
              qrCode: qr,
            },
          })
        ).id;

      // Student A: Tuition 500 → seq1 250 (overdue, fully paid), seq2 250 (future, upcoming).
      const aId = await mkStudent('Omar', `QR-${TENANT}-a`);
      const aAcct = await tx.studentFinancialAccount.create({
        data: { tenantId: TENANT, studentId: aId, payerId: payer.id },
      });
      const aCharge = await tx.charge.create({
        data: {
          tenantId: TENANT,
          accountId: aAcct.id,
          studentId: aId,
          description: 'Tuition',
          amount: '500.000',
          status: 'PARTIAL',
        },
      });
      const aSeq1 = await tx.installment.create({
        data: {
          tenantId: TENANT,
          chargeId: aCharge.id,
          seq: 1,
          amount: '250.000',
          dueDate: new Date('2020-01-01'),
          status: 'PAID',
        },
      });
      await tx.installment.create({
        data: {
          tenantId: TENANT,
          chargeId: aCharge.id,
          seq: 2,
          amount: '250.000',
          dueDate: new Date('2099-01-01'),
          status: 'SCHEDULED',
        },
      });
      // Verified payment fully allocated to A/seq1.
      const pay = await tx.payment.create({
        data: {
          tenantId: TENANT,
          payerId: payer.id,
          accountId: aAcct.id,
          studentId: aId,
          accountScoped: true,
          amount: '250.000',
          method: 'CASH',
          status: 'VERIFIED',
          verifiedAt: new Date(),
        },
      });
      await tx.paymentAllocation.create({
        data: {
          tenantId: TENANT,
          paymentId: pay.id,
          installmentId: aSeq1.id,
          amount: '250.000',
        },
      });

      // Student B: Transport 200 → seq1 200 due same date as A/seq1 (overdue, unpaid).
      const bId = await mkStudent('Sara', `QR-${TENANT}-b`);
      const bAcct = await tx.studentFinancialAccount.create({
        data: { tenantId: TENANT, studentId: bId, payerId: payer.id },
      });
      const bCharge = await tx.charge.create({
        data: {
          tenantId: TENANT,
          accountId: bAcct.id,
          studentId: bId,
          description: 'Transport',
          amount: '200.000',
          status: 'PENDING',
        },
      });
      await tx.installment.create({
        data: {
          tenantId: TENANT,
          chargeId: bCharge.id,
          seq: 1,
          amount: '200.000',
          dueDate: new Date('2020-01-01'),
          status: 'SCHEDULED',
        },
      });
    });

    token = (
      await http()
        .post('/api/v1/auth/login')
        .send({ email: 'fin@bs.example', password: PASSWORD, tenantSlug: 'bs' })
        .expect(200)
    ).body.accessToken as string;
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  it('merges both students’ installments into one schedule keyed by due date', async () => {
    const res = await http()
      .get(`/api/v1/finance/families/${payerId}/schedule`)
      .set(auth())
      .expect(200);
    const body = res.body as {
      rows: Row[];
      totals: { amount: string; paid: string; balance: string };
    };

    // Totals across the whole account: 500 (A) + 200 (B) = 700, paid 250, balance 450.
    expect(Number(body.totals.amount)).toBe(700);
    expect(Number(body.totals.paid)).toBe(250);
    expect(Number(body.totals.balance)).toBe(450);

    // Two due dates → two rows (2020-01-01, 2099-01-01).
    expect(body.rows.length).toBe(2);

    // The shared 2020-01-01 row merges A/Tuition (paid) + B/Transport (overdue).
    const shared = body.rows.find((r) => r.dueDate?.startsWith('2020-01-01'));
    expect(shared).toBeDefined();
    expect(Number(shared!.amount)).toBe(450);
    expect(Number(shared!.paid)).toBe(250);
    expect(Number(shared!.balance)).toBe(200);
    expect(shared!.status).toBe('OVERDUE'); // B is overdue & unpaid
    expect(shared!.lines.length).toBe(2);
    const paidLine = shared!.lines.find((l) => l.chargeDescription === 'Tuition');
    const overdueLine = shared!.lines.find((l) => l.chargeDescription === 'Transport');
    expect(paidLine!.status).toBe('PAID');
    expect(Number(paidLine!.balance)).toBe(0);
    expect(overdueLine!.status).toBe('OVERDUE');
    expect(overdueLine!.studentName).toContain('Sara');

    // The future row is a single upcoming line.
    const future = body.rows.find((r) => r.dueDate?.startsWith('2099-01-01'));
    expect(future).toBeDefined();
    expect(future!.status).toBe('UPCOMING');
    expect(Number(future!.balance)).toBe(250);
  });
});

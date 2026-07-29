/**
 * Manual allocation + student→account deep-link (e2e), Phases 3–4 of the unified workspace.
 *
 *  - GET /finance/families/by-student/:id resolves a student to their Financial Account.
 *  - POST /finance/payments/family/:id with `allocations` verifies the payment and applies it to the
 *    chosen installments (cross-student), banking any residue as account credit — instead of FIFO.
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

const TENANT = 'aaaa3333-aaaa-3333-aaaa-333333333333';
const PASSWORD = 'Sup3rSecret!';

describe('Manual allocation + deep-link (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let payerId: string;
  let studentA: string;
  let aInst: string;
  let bInst: string;

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
      await tx.tenant.create({ data: { id: TENANT, name: 'ma', slug: 'ma', status: 'ACTIVE' } });
      await rbac.provisionTenantRoles(tx, TENANT);
      const u = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'fin@ma.example',
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
          lastNameEn: 'Ma',
          firstNameAr: 'اب',
          lastNameAr: 'م',
          phone: '+962790007777',
        },
      });
      const payer = await tx.payer.create({
        data: { tenantId: TENANT, parentId: parent.id, nameEn: 'Ma Family', nameAr: 'ما' },
      });
      payerId = payer.id;

      const mk = async (fn: string, qr: string, desc: string, amount: string) => {
        const s = await tx.student.create({
          data: {
            tenantId: TENANT,
            firstNameEn: fn,
            lastNameEn: 'Ma',
            firstNameAr: 'ط',
            lastNameAr: 'م',
            qrCode: qr,
          },
        });
        const acct = await tx.studentFinancialAccount.create({
          data: { tenantId: TENANT, studentId: s.id, payerId: payer.id },
        });
        const charge = await tx.charge.create({
          data: {
            tenantId: TENANT,
            accountId: acct.id,
            studentId: s.id,
            description: desc,
            amount,
            status: 'PENDING',
          },
        });
        const inst = await tx.installment.create({
          data: {
            tenantId: TENANT,
            chargeId: charge.id,
            seq: 1,
            amount,
            dueDate: new Date('2099-01-01'),
            status: 'SCHEDULED',
          },
        });
        return { studentId: s.id, instId: inst.id };
      };

      const a = await mk('Omar', `QR-${TENANT}-a`, 'Tuition', '250.000');
      const b = await mk('Sara', `QR-${TENANT}-b`, 'Transport', '200.000');
      studentA = a.studentId;
      aInst = a.instId;
      bInst = b.instId;
    });

    token = (
      await http()
        .post('/api/v1/auth/login')
        .send({ email: 'fin@ma.example', password: PASSWORD, tenantSlug: 'ma' })
        .expect(200)
    ).body.accessToken as string;
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  it('resolves a student to their Financial Account (deep-link)', async () => {
    const res = await http()
      .get(`/api/v1/finance/families/by-student/${studentA}`)
      .set(auth())
      .expect(200);
    expect(res.body.account?.id).toBe(payerId);
    expect(res.body.studentId).toBe(studentA);
  });

  it('applies a manual allocation across students and banks the residue as account credit', async () => {
    // Pay 300: 250 → Omar/Tuition (full), 20 → Sara/Transport (partial), residue 30 → credit.
    const res = await http()
      .post(`/api/v1/finance/payments/family/${payerId}`)
      .set(auth())
      .send({
        amount: 300,
        method: 'CASH',
        allocations: [
          { installmentId: aInst, amount: 250 },
          { installmentId: bInst, amount: 20 },
        ],
      })
      .expect(201);
    expect(res.body.status).toBe('VERIFIED'); // manual allocation settles the payment

    await withPlatform(prisma, async (tx) => {
      const a = await tx.installment.findUniqueOrThrow({ where: { id: aInst } });
      const b = await tx.installment.findUniqueOrThrow({ where: { id: bInst } });
      expect(a.status).toBe('PAID'); // 250 of 250
      expect(b.status).toBe('PARTIAL'); // 20 of 200

      const allocs = await tx.paymentAllocation.findMany({ where: { tenantId: TENANT } });
      expect(allocs.length).toBe(2);
      const aAlloc = allocs.find((x) => x.installmentId === aInst);
      const bAlloc = allocs.find((x) => x.installmentId === bInst);
      expect(Number(aAlloc!.amount)).toBe(250);
      expect(Number(bAlloc!.amount)).toBe(20);

      // Residue 30 banked as an account credit (owned by the payer).
      const credit = await tx.credit.findFirst({ where: { tenantId: TENANT, payerId } });
      expect(credit).not.toBeNull();
      expect(Number(credit!.amount)).toBe(30);
    });
  });

  it('rejects an allocation that exceeds the installment balance', async () => {
    await http()
      .post(`/api/v1/finance/payments/family/${payerId}`)
      .set(auth())
      .send({
        amount: 500,
        method: 'CASH',
        allocations: [{ installmentId: bInst, amount: 500 }], // balance is only 180 now
      })
      .expect(400);
  });

  it('an automatic (no-allocations) payment settles immediately and allocates FIFO', async () => {
    // Fresh student C with the earliest-due open installment, so FIFO lands the payment on it.
    let cInst = '';
    await withPlatform(prisma, async (tx) => {
      const s = await tx.student.create({
        data: {
          tenantId: TENANT,
          firstNameEn: 'Adam',
          lastNameEn: 'Ma',
          firstNameAr: 'ط',
          lastNameAr: 'م',
          qrCode: `QR-${TENANT}-c`,
        },
      });
      const acct = await tx.studentFinancialAccount.create({
        data: { tenantId: TENANT, studentId: s.id, payerId },
      });
      const charge = await tx.charge.create({
        data: {
          tenantId: TENANT,
          accountId: acct.id,
          studentId: s.id,
          description: 'Books',
          amount: '100.000',
          status: 'PENDING',
        },
      });
      const inst = await tx.installment.create({
        data: {
          tenantId: TENANT,
          chargeId: charge.id,
          seq: 1,
          amount: '100.000',
          dueDate: new Date('2019-01-01'),
          status: 'SCHEDULED',
        },
      });
      cInst = inst.id;
    });

    const res = await http()
      .post(`/api/v1/finance/payments/family/${payerId}`)
      .set(auth())
      .send({ amount: 100, method: 'CASH' }) // automatic — no allocations
      .expect(201);
    expect(res.body.status).toBe('VERIFIED'); // settles immediately, no pending step
    expect(res.body.receiptNo).toBeGreaterThan(0); // official receipt assigned on verify

    await withPlatform(prisma, async (tx) => {
      const inst = await tx.installment.findUniqueOrThrow({ where: { id: cInst } });
      expect(inst.status).toBe('PAID'); // FIFO applied the 100 to the earliest-due installment
    });
  });
});

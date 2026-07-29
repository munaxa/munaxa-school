/**
 * Account-owned collections (e2e). Two siblings billed through ONE Financial Account (Payer) share a
 * single CollectionsCase: setting the account's status via one student projects to the other, and a
 * promise-to-pay logged for one sibling is visible on the other — collections lives on the account,
 * and a student only references the account's status.
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

const TENANT = 'cccc8888-cccc-8888-cccc-888888888888';
const PASSWORD = 'Sup3rSecret!';
const C = '/api/v1/finance/collections';

describe('Account-owned collections (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let sA: string;
  let sB: string;

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
      await tx.tenant.create({
        data: { id: TENANT, name: 'colacc', slug: 'colacc', status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT);
      const u = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'fin@colacc.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT, u.id, RoleKey.FinanceOfficer);

      const mk = async (qr: string) =>
        (
          await tx.student.create({
            data: {
              tenantId: TENANT,
              firstNameEn: qr,
              lastNameEn: 'Sib',
              firstNameAr: 'اخ',
              lastNameAr: 'ب',
              qrCode: qr,
            },
          })
        ).id;
      sA = await mk(`QR-${TENANT}-a`);
      sB = await mk(`QR-${TENANT}-b`);

      // ONE guardian → ONE payer (account) shared by both siblings.
      const parent = await tx.parent.create({
        data: {
          tenantId: TENANT,
          firstNameEn: 'Dad',
          lastNameEn: 'Sib',
          firstNameAr: 'اب',
          lastNameAr: 'ب',
          phone: '+962790001111',
        },
      });
      const payer = await tx.payer.create({
        data: { tenantId: TENANT, parentId: parent.id, nameEn: 'Dad Sib', nameAr: 'اب ب' },
      });
      for (const studentId of [sA, sB]) {
        await tx.parentStudent.create({
          data: { tenantId: TENANT, parentId: parent.id, studentId, relation: 'FATHER' },
        });
        const acct = await tx.studentFinancialAccount.create({
          data: { tenantId: TENANT, studentId, payerId: payer.id },
        });
        const charge = await tx.charge.create({
          data: {
            tenantId: TENANT,
            accountId: acct.id,
            studentId,
            description: 'Tuition',
            amount: '500.000',
            status: 'PENDING',
          },
        });
        await tx.installment.create({
          data: { tenantId: TENANT, chargeId: charge.id, seq: 1, amount: '500.000' },
        });
      }
    });

    token = (
      await http()
        .post('/api/v1/auth/login')
        .send({ email: 'fin@colacc.example', password: PASSWORD, tenantSlug: 'colacc' })
        .expect(200)
    ).body.accessToken as string;
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  it('setting LEGAL via one sibling flags the whole account (both students) with ONE case', async () => {
    await http()
      .put(`${C}/students/${sA}`)
      .set(auth())
      .send({ status: 'LEGAL', note: 'Account referred to lawyer' })
      .expect(200);

    // Both siblings now reference the account status.
    const a = await http().get(`${C}/students/${sA}`).set(auth()).expect(200);
    const b = await http().get(`${C}/students/${sB}`).set(auth()).expect(200);
    expect(a.body.collectionsStatus).toBe('LEGAL');
    expect(b.body.collectionsStatus).toBe('LEGAL');

    // Exactly ONE collections case exists for the account (payer-owned).
    await withPlatform(prisma, async (tx) => {
      const payer = await tx.payer.findFirst({ where: { tenantId: TENANT } });
      const cases = await tx.collectionsCase.count({ where: { payerId: payer!.id } });
      expect(cases).toBe(1);
      const anyAccountKeyed = await tx.collectionsCase.count({
        where: { tenantId: TENANT, accountId: { not: null } },
      });
      expect(anyAccountKeyed).toBe(0); // never per-student when the account has a payer
    });
  });

  it('a promise logged on one sibling is visible on the other (shared account case)', async () => {
    await http()
      .post(`${C}/students/${sA}/promises`)
      .set(auth())
      .send({ amount: '250.000', promiseBy: '2027-01-01', note: 'partial' })
      .expect(201);
    const onB = await http().get(`${C}/students/${sB}/promises`).set(auth()).expect(200);
    expect(onB.body.length).toBeGreaterThanOrEqual(1);
    expect(Number(onB.body[0].amount)).toBe(250);
  });
});

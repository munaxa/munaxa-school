/**
 * End-to-end tests for the Finance ↔ JoFotara bridge (Phase 19): auto-issuing an e-invoice when
 * a fee charge is raised, auto-issuing a 381 credit note when an invoiced charge is reduced, the
 * guardian-as-buyer mapping, idempotency, and the best-effort behaviour (a charge is never blocked
 * by an e-invoicing problem). Uses the SIMULATION environment.
 */
import { randomBytes } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/services/password.service';
import { RbacService } from '../src/auth/services/rbac.service';
import { withPlatform } from '../src/prisma/tenant.helpers';
import { SubmissionWorker } from '../src/einvoicing/submission.worker';
import { RoleKey } from '@school/domain';

const TENANT = 'b71d6e00-5555-4555-8555-555555555555';
const PASSWORD = 'Sup3rSecret!';

describe('Finance ↔ JoFotara bridge (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let worker: SubmissionWorker;
  let financeToken: string;
  let adminToken: string;
  let withGuardian: string;
  let noGuardian: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());
  const E = '/api/v1/einvoicing';

  beforeAll(async () => {
    process.env.EINVOICE_WORKER = '0';
    process.env.EINVOICE_MASTER_KEY = randomBytes(32).toString('base64');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);
    worker = moduleRef.get(SubmissionWorker);
    const passwords = moduleRef.get(PasswordService);
    const rbac = moduleRef.get(RbacService);
    const hash = await passwords.hash(PASSWORD);

    await withPlatform(prisma, async (tx) => {
      await tx.tenant.deleteMany({ where: { id: TENANT } });
      await tx.tenant.create({ data: { id: TENANT, name: 'brg', slug: 'brg', status: 'ACTIVE' } });
      await rbac.provisionTenantRoles(tx, TENANT);

      const mkStudent = async (qr: string) => {
        const st = await tx.student.create({
          data: {
            tenantId: TENANT,
            firstNameEn: 'Sara',
            lastNameEn: qr,
            firstNameAr: 'سارة',
            lastNameAr: 'ع',
            qrCode: qr,
          },
        });
        return st.id;
      };
      withGuardian = await mkStudent(`QR-${TENANT}-g`);
      noGuardian = await mkStudent(`QR-${TENANT}-n`);

      const fin = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'finance@brg.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT, fin.id, RoleKey.FinanceOfficer);
      const admin = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'admin@brg.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT, admin.id, RoleKey.SchoolAdmin);

      // A guardian with a national ID → becomes the invoice buyer (NIN).
      const parent = await tx.parent.create({
        data: {
          tenantId: TENANT,
          firstNameEn: 'Omar',
          lastNameEn: 'Haddad',
          firstNameAr: 'عمر',
          lastNameAr: 'الحداد',
          nationalId: '9901012345',
        },
      });
      await tx.parentStudent.create({
        data: {
          tenantId: TENANT,
          parentId: parent.id,
          studentId: withGuardian,
          relation: 'FATHER',
          isPrimary: true,
        },
      });
    });

    financeToken = await login('finance@brg.example');
    adminToken = await login('admin@brg.example');

    // Enable e-invoicing + auto-issue, SIMULATION, with the required legal info.
    await http()
      .put('/api/v1/feature-flags/e_invoicing')
      .set(auth(adminToken))
      .send({ enabled: true })
      .expect(200);
    await http()
      .patch(`${E}/settings`)
      .set(auth(financeToken))
      .send({
        enabled: true,
        environment: 'SIMULATION',
        legalNameEn: 'Green Valley School',
        taxNumber: '123456789',
        taxpayerType: 'INCOME',
        autoIssueOnCharge: true,
        autoCreditOnAdjustment: true,
      })
      .expect(200);
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'brg' })
      .expect(200);
    return res.body.accessToken as string;
  }

  async function charge(
    studentId: string,
    amount: number,
    description = 'Tuition',
  ): Promise<string> {
    const res = await http()
      .post('/api/v1/finance/charges')
      .set(auth(financeToken))
      .send({ studentId, description, amount })
      .expect(201);
    return res.body.id as string;
  }

  async function docs() {
    const res = await http().get(`${E}/documents`).set(auth(financeToken)).expect(200);
    return res.body as Array<{
      id: string;
      docType: string;
      status: string;
      chargeId: string | null;
      buyerName: string | null;
      buyerIdValue: string | null;
      payableAmount: string;
      originalDocumentId: string | null;
    }>;
  }

  // ---- Auto-issue invoice from a charge -------------------------------------

  let chargeId: string;
  let invoiceDocId: string;

  it('auto-issues a queued JoFotara invoice when a charge is raised, with the guardian as buyer', async () => {
    chargeId = await charge(withGuardian, 600);
    const list = await docs();
    const doc = list.find((d) => d.chargeId === chargeId && d.docType === 'INVOICE');
    expect(doc).toBeTruthy();
    invoiceDocId = doc!.id;
    expect(doc!.status).toBe('QUEUED');
    expect(doc!.buyerName).toContain('عمر'); // guardian
    expect(doc!.buyerIdValue).toBe('9901012345'); // NIN
    expect(Number(doc!.payableAmount)).toBe(600);
  });

  it('the worker submits it (SIMULATION) → ACCEPTED with a QR', async () => {
    await worker.tick();
    const doc = await http()
      .get(`${E}/documents/${invoiceDocId}`)
      .set(auth(financeToken))
      .expect(200);
    expect(doc.body.status).toBe('ACCEPTED');
    expect(doc.body.qrCode).toContain('SIMULATED-QR-');
    expect(doc.body.submittedXml).toContain('<cbc:InvoiceTypeCode name="021">388'); // receivable income
    expect(doc.body.submittedXml).toContain('currencyID="JO"');
  });

  it('is idempotent — re-issuing the same charge is refused (409)', async () => {
    await http().post(`${E}/from-charge/${chargeId}`).set(auth(financeToken)).expect(409);
  });

  // ---- Auto-credit note from a charge reduction -----------------------------

  it('auto-issues a 381 credit note when the invoiced charge is discounted', async () => {
    await http()
      .post('/api/v1/finance/ledger/adjustments')
      .set(auth(financeToken))
      .send({
        studentId: withGuardian,
        chargeId,
        type: 'SCHOLARSHIP',
        amount: 100,
        reason: 'Late scholarship',
      })
      .expect(201);

    const list = await docs();
    const credit = list.find(
      (d) => d.docType === 'CREDIT_NOTE' && d.originalDocumentId === invoiceDocId,
    );
    expect(credit).toBeTruthy();
    expect(Number(credit!.payableAmount)).toBe(100);

    await worker.tick();
    const doc = await http()
      .get(`${E}/documents/${credit!.id}`)
      .set(auth(financeToken))
      .expect(200);
    expect(doc.body.status).toBe('ACCEPTED');
    expect(doc.body.submittedXml).toContain('>381</cbc:InvoiceTypeCode>');
    expect(doc.body.submittedXml).toContain('<cac:BillingReference>');
    expect(doc.body.submittedXml).toContain('Late scholarship');
  });

  // ---- Best-effort: never blocks a charge -----------------------------------

  it('still creates the charge when there is no guardian (auto-issue skipped, not failed)', async () => {
    const cid = await charge(noGuardian, 300); // succeeds (201) despite no buyer
    const list = await docs();
    expect(list.find((d) => d.chargeId === cid)).toBeFalsy(); // no invoice issued
    // …and an explicit issue surfaces the reason.
    await http().post(`${E}/from-charge/${cid}`).set(auth(financeToken)).expect(400);
  });
});

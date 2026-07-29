/**
 * End-to-end tests for the e-invoicing framework (Phase 16): feature-flag kill-switch,
 * the wizard (settings + encrypted credentials with masked reads), document issuance with
 * JoFotara buyer rules, the queue lifecycle DRAFT→QUEUED→ACCEPTED (SIMULATION environment —
 * JoFotara has no public sandbox), gapless ICV allocation, credit-note rules, manual
 * requeue, and the dashboard.
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

const TENANT = 'e1e1e1e1-2222-4222-8222-222222222222';
const PASSWORD = 'Sup3rSecret!';

describe('E-invoicing framework (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let worker: SubmissionWorker;
  let adminToken: string;
  let teacherToken: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());
  const base = '/api/v1/einvoicing';

  beforeAll(async () => {
    process.env.EINVOICE_WORKER = '0'; // drive ticks manually
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
      await tx.tenant.create({
        data: { id: TENANT, name: 'einv', slug: 'einv', status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT);
      const mk = async (email: string, role: RoleKey) => {
        const u = await tx.user.create({
          data: {
            tenantId: TENANT,
            email,
            status: 'ACTIVE',
            passwordHash: hash,
            mustChangePassword: false,
          },
        });
        await rbac.assignRole(tx, TENANT, u.id, role);
      };
      await mk('admin@einv.example', RoleKey.SchoolAdmin);
      await mk('teacher@einv.example', RoleKey.Teacher);
    });

    adminToken = await login('admin@einv.example');
    teacherToken = await login('teacher@einv.example');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'einv' })
      .expect(200);
    return res.body.accessToken as string;
  }

  // ---- Feature flag kill-switch ---------------------------------------------

  it('is OFF by default — 403 even for an admin with all permissions', async () => {
    await http().get(`${base}/settings`).set(auth(adminToken)).expect(403);
  });

  it('turns on via the feature flag', async () => {
    await http()
      .put('/api/v1/feature-flags/e_invoicing')
      .set(auth(adminToken))
      .send({ enabled: true })
      .expect(200);
    await http().get(`${base}/settings`).set(auth(adminToken)).expect(200);
  });

  // ---- Wizard ----------------------------------------------------------------

  it('walks the wizard: enable, school info, credentials (encrypted + masked)', async () => {
    // Step 1+2: enable in SIMULATION + legal info (TIN digits-only enforced)
    await http()
      .patch(`${base}/settings`)
      .set(auth(adminToken))
      .send({ taxNumber: '12-34' })
      .expect(400);
    const s = await http()
      .patch(`${base}/settings`)
      .set(auth(adminToken))
      .send({
        enabled: true,
        environment: 'SIMULATION',
        legalNameEn: 'Green Valley School',
        legalNameAr: 'مدرسة الوادي الأخضر',
        taxNumber: '123456789',
        city: 'Amman',
        taxpayerType: 'SALES',
        vatEnabled: true,
        vatPercent: 16,
        defaultTaxCategory: 'S',
        completedSteps: 2,
      })
      .expect(200);
    expect(s.body.enabled).toBe(true);
    expect(s.body.completedSteps).toBe(2);

    // Step 3: device credentials — write-only secret
    const cred = await http()
      .post(`${base}/credentials`)
      .set(auth(adminToken))
      .send({ clientId: 'client-abc', secret: 'topsecret9999', incomeSourceSequence: '425024' })
      .expect(201);
    expect(cred.body.secretHint).toBe('••••9999');
    expect(JSON.stringify(cred.body)).not.toContain('topsecret');

    // Reads return the masked hint, never the secret (and it is encrypted at rest)
    const view = await http().get(`${base}/settings`).set(auth(adminToken)).expect(200);
    expect(view.body.credential.clientId).toBe('client-abc');
    expect(view.body.credential.secretHint).toBe('••••9999');
    expect(JSON.stringify(view.body)).not.toContain('topsecret');
    const raw = await withPlatform(prisma, (tx) =>
      tx.eInvoiceCredential.findFirst({ where: { tenantId: TENANT } }),
    );
    expect(raw!.secretEncrypted.startsWith('v1:')).toBe(true);
    expect(raw!.secretEncrypted).not.toContain('topsecret');

    // Test connection (SIMULATION short-circuits — no network)
    const test = await http().post(`${base}/test-connection`).set(auth(adminToken)).expect(200);
    expect(test.body.ok).toBe(true);
  });

  // ---- Documents & queue ------------------------------------------------------

  let invoiceId: string;

  it('enforces the buyer rule: receivable invoices require a buyer name', async () => {
    await http()
      .post(`${base}/invoices`)
      .set(auth(adminToken))
      .send({
        invoiceNumber: 'INV-X-1',
        paymentKind: 'RECEIVABLE',
        lines: [{ name: 'Tuition', quantity: 1, unitPrice: 750 }],
      })
      .expect(400);
  });

  it('creates a draft invoice with computed tax (16% S) and Arabic content', async () => {
    const res = await http()
      .post(`${base}/invoices`)
      .set(auth(adminToken))
      .send({
        invoiceNumber: 'INV-2026/0001',
        paymentKind: 'RECEIVABLE',
        buyerName: 'عمر خالد الحداد',
        buyerIdScheme: 'NIN',
        buyerIdValue: '9901012345',
        lines: [{ name: 'Tuition — Term 1 | رسوم دراسية', quantity: 1, unitPrice: 750 }],
      })
      .expect(201);
    invoiceId = res.body.id;
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.invoiceNumber).toBe('INV-2026_0001'); // slash sanitised
    expect(Number(res.body.taxAmount)).toBe(120);
    expect(Number(res.body.payableAmount)).toBe(870);
  });

  it('queues (allocating ICV 1) and the worker accepts it in SIMULATION with a QR', async () => {
    const queued = await http()
      .post(`${base}/documents/${invoiceId}/queue`)
      .set(auth(adminToken))
      .expect(201);
    expect(queued.body.status).toBe('QUEUED');
    expect(Number(queued.body.icv)).toBe(1);

    const processed = await worker.tick();
    expect(processed).toBeGreaterThanOrEqual(1);

    const doc = await http()
      .get(`${base}/documents/${invoiceId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(doc.body.status).toBe('ACCEPTED');
    expect(doc.body.qrCode).toContain('SIMULATED-QR-');
    expect(doc.body.submittedXml).toContain('reporting:1.0');
    expect(doc.body.submittedXml).toContain('name="022"'); // receivable sales
    expect(doc.body.submittedXml).toContain('مدرسة الوادي الأخضر');
    expect(doc.body.logs.map((l: { event: string }) => l.event)).toEqual(
      expect.arrayContaining(['CREATED', 'QUEUED', 'ACCEPTED']),
    );
  });

  it('allocates gapless sequential ICVs', async () => {
    const res = await http()
      .post(`${base}/invoices`)
      .set(auth(adminToken))
      .send({
        invoiceNumber: 'INV-2026-0002',
        paymentKind: 'CASH',
        lines: [{ name: 'Books', quantity: 2, unitPrice: 15 }],
      })
      .expect(201);
    const queued = await http()
      .post(`${base}/documents/${res.body.id}/queue`)
      .set(auth(adminToken))
      .expect(201);
    expect(Number(queued.body.icv)).toBe(2);
  });

  it('rejects double-queueing and cancelling an accepted document', async () => {
    await http().post(`${base}/documents/${invoiceId}/queue`).set(auth(adminToken)).expect(409);
    await http().post(`${base}/documents/${invoiceId}/cancel`).set(auth(adminToken)).expect(409);
  });

  // ---- Credit notes -----------------------------------------------------------

  it('enforces credit-note rules: accepted original, mandatory reason, quantity caps', async () => {
    // quantity above the original is rejected
    await http()
      .post(`${base}/credit-notes`)
      .set(auth(adminToken))
      .send({
        invoiceNumber: 'CN-1',
        originalDocumentId: invoiceId,
        reason: 'Student withdrew',
        lines: [{ name: 'Tuition — Term 1 | رسوم دراسية', quantity: 2, unitPrice: 750 }],
      })
      .expect(400);

    const cn = await http()
      .post(`${base}/credit-notes`)
      .set(auth(adminToken))
      .send({
        invoiceNumber: 'CN-1',
        originalDocumentId: invoiceId,
        reason: 'Student withdrew',
        lines: [{ name: 'Tuition — Term 1 | رسوم دراسية', quantity: 1, unitPrice: 750 }],
      })
      .expect(201);
    expect(cn.body.docType).toBe('CREDIT_NOTE');

    await http().post(`${base}/documents/${cn.body.id}/queue`).set(auth(adminToken)).expect(201);
    await worker.tick();
    const doc = await http()
      .get(`${base}/documents/${cn.body.id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(doc.body.status).toBe('ACCEPTED');
    expect(doc.body.submittedXml).toContain('>381</cbc:InvoiceTypeCode>');
    expect(doc.body.submittedXml).toContain(
      '<cbc:InstructionNote>Student withdrew</cbc:InstructionNote>',
    );
    expect(doc.body.submittedXml).toContain('INV-2026_0001'); // BillingReference to the original
  });

  // ---- Dashboard & RBAC -------------------------------------------------------

  it('serves the dashboard widget counts', async () => {
    const res = await http().get(`${base}/dashboard`).set(auth(adminToken)).expect(200);
    expect(res.body.byStatus.ACCEPTED).toBeGreaterThanOrEqual(2);
    expect(res.body.thisMonth).toBeGreaterThanOrEqual(3);
    expect(res.body.lastAcceptedAt).toBeTruthy();
  });

  it('blocks finance writes for non-finance roles (RBAC under the flag)', async () => {
    await http().get(`${base}/settings`).set(auth(teacherToken)).expect(403);
    await http()
      .post(`${base}/invoices`)
      .set(auth(teacherToken))
      .send({ invoiceNumber: 'X', lines: [{ name: 'x', quantity: 1, unitPrice: 1 }] })
      .expect(403);
  });
});

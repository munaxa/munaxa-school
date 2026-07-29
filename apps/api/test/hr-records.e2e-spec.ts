/**
 * End-to-end tests for HR Phase 2 against a real PostgreSQL: employment contracts (+ renewal),
 * employee documents (presign → confirm → download → versioning), the personal sub-records, and
 * per-capability RBAC (incl. sensitive bank-account gating).
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

const TENANT = '66666666-6666-6666-6666-666666666666';
const PASSWORD = 'Sup3rSecret!';

describe('HR records — contracts & documents (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let vpToken: string;
  let employeeId: string;

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
      await tx.tenant.deleteMany({ where: { id: TENANT } });
      await tx.tenant.create({
        data: { id: TENANT, name: 'hrrec', slug: 'hrrec', status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT);
      for (const [email, role] of [
        ['admin@hrrec.example', RoleKey.SchoolAdmin],
        ['vp@hrrec.example', RoleKey.VicePrincipal],
      ] as const) {
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
      }
    });

    adminToken = await login('admin@hrrec.example');
    vpToken = await login('vp@hrrec.example');

    const emp = await http()
      .post('/api/v1/employees')
      .set(auth(adminToken))
      .send({
        firstNameEn: 'Sara',
        lastNameEn: 'Odeh',
        firstNameAr: 'سارة',
        lastNameAr: 'عودة',
        jobTitle: 'Accountant',
      })
      .expect(201);
    employeeId = emp.body.id;
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.deleteMany({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'hrrec' })
      .expect(200);
    return res.body.accessToken as string;
  }

  // ----- Contracts ----------------------------------------------------------
  let contractId: string;

  it('creates, lists and renews a contract', async () => {
    const created = await http()
      .post(`/api/v1/employees/${employeeId}/contracts`)
      .set(auth(adminToken))
      .send({
        contractType: 'PERMANENT',
        startDate: '2026-01-01',
        baseSalary: 850.5,
        allowances: [{ name: 'Transport', amount: 50 }],
        vacationDays: 21,
      })
      .expect(201);
    expect(created.body.contractType).toBe('PERMANENT');
    expect(created.body.status).toBe('DRAFT');
    contractId = created.body.id;

    const list = await http()
      .get(`/api/v1/employees/${employeeId}/contracts`)
      .set(auth(adminToken))
      .expect(200);
    expect(list.body).toHaveLength(1);

    // Renew → new contract + previous becomes RENEWED.
    const renewal = await http()
      .post(`/api/v1/employees/${employeeId}/contracts/${contractId}/renew`)
      .set(auth(adminToken))
      .send({ contractType: 'PERMANENT', startDate: '2027-01-01', baseSalary: 900 })
      .expect(201);
    expect(renewal.body.renewedFromId).toBe(contractId);

    const prev = await http()
      .get(`/api/v1/employees/${employeeId}/contracts/${contractId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(prev.body.status).toBe('RENEWED');
  });

  it('rejects endDate before startDate', async () => {
    await http()
      .post(`/api/v1/employees/${employeeId}/contracts`)
      .set(auth(adminToken))
      .send({ contractType: 'TEMPORARY', startDate: '2026-06-01', endDate: '2026-01-01' })
      .expect(400);
  });

  // ----- Documents ----------------------------------------------------------
  let documentId: string;

  it('presigns, confirms, versions and downloads a document', async () => {
    const presign = await http()
      .post(`/api/v1/employees/${employeeId}/documents/presign`)
      .set(auth(adminToken))
      .send({ fileName: 'contract.pdf', contentType: 'application/pdf', size: 1024 })
      .expect(201);
    expect(presign.body.fileKey).toContain(`tenants/${TENANT}/employees/${employeeId}/`);

    const doc = await http()
      .post(`/api/v1/employees/${employeeId}/documents`)
      .set(auth(adminToken))
      .send({
        type: 'CONTRACT',
        title: 'Signed contract',
        fileKey: presign.body.fileKey,
        fileName: 'contract.pdf',
        contentType: 'application/pdf',
        size: 1024,
        expiryDate: '2027-12-31',
      })
      .expect(201);
    expect(doc.body.version).toBe(1);
    expect(doc.body.downloadUrl).toBeTruthy();
    documentId = doc.body.id;

    // A superseding upload bumps the version.
    const presign2 = await http()
      .post(`/api/v1/employees/${employeeId}/documents/presign`)
      .set(auth(adminToken))
      .send({ fileName: 'contract-v2.pdf', contentType: 'application/pdf', size: 2048 })
      .expect(201);
    const v2 = await http()
      .post(`/api/v1/employees/${employeeId}/documents`)
      .set(auth(adminToken))
      .send({
        type: 'CONTRACT',
        title: 'Signed contract (v2)',
        fileKey: presign2.body.fileKey,
        fileName: 'contract-v2.pdf',
        contentType: 'application/pdf',
        size: 2048,
        supersedesId: documentId,
      })
      .expect(201);
    expect(v2.body.version).toBe(2);

    const dl = await http()
      .get(`/api/v1/employees/${employeeId}/documents/${documentId}/download`)
      .set(auth(adminToken))
      .expect(200);
    expect(dl.body.url).toBeTruthy();
  });

  it('rejects a disallowed document content type', async () => {
    await http()
      .post(`/api/v1/employees/${employeeId}/documents/presign`)
      .set(auth(adminToken))
      .send({ fileName: 'x.exe', contentType: 'application/x-msdownload', size: 10 })
      .expect(400);
  });

  // ----- Personal sub-records ----------------------------------------------
  it('manages emergency contacts, dependents, education and certificates', async () => {
    const ec = await http()
      .post(`/api/v1/employees/${employeeId}/emergency-contacts`)
      .set(auth(adminToken))
      .send({ name: 'Ahmad Odeh', relation: 'Spouse', phone: '0790000000', isPrimary: true })
      .expect(201);
    expect(ec.body.name).toBe('Ahmad Odeh');

    await http()
      .post(`/api/v1/employees/${employeeId}/dependents`)
      .set(auth(adminToken))
      .send({ name: 'Lina Odeh', relation: 'CHILD', dateOfBirth: '2015-05-01' })
      .expect(201);

    await http()
      .post(`/api/v1/employees/${employeeId}/education`)
      .set(auth(adminToken))
      .send({ institution: 'University of Jordan', degree: 'BSc Accounting', endYear: 2014 })
      .expect(201);

    const cert = await http()
      .post(`/api/v1/employees/${employeeId}/certificates`)
      .set(auth(adminToken))
      .send({ name: 'CPA', issuingBody: 'AICPA', issueDate: '2016-03-01' })
      .expect(201);

    await http()
      .patch(`/api/v1/employees/${employeeId}/certificates/${cert.body.id}`)
      .set(auth(adminToken))
      .send({ credentialId: 'CPA-12345' })
      .expect(200);

    const list = await http()
      .get(`/api/v1/employees/${employeeId}/emergency-contacts`)
      .set(auth(adminToken))
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('gates sensitive bank accounts behind hr:sensitive:read', async () => {
    await http()
      .post(`/api/v1/employees/${employeeId}/bank-accounts`)
      .set(auth(adminToken))
      .send({ bankName: 'Arab Bank', iban: 'JO94CBJO0010000000000131000302' })
      .expect(201);

    // Admin (SchoolAdmin '*') can read.
    const asAdmin = await http()
      .get(`/api/v1/employees/${employeeId}/bank-accounts`)
      .set(auth(adminToken))
      .expect(200);
    expect(asAdmin.body).toHaveLength(1);

    // VicePrincipal lacks hr:sensitive:read → 403.
    await http()
      .get(`/api/v1/employees/${employeeId}/bank-accounts`)
      .set(auth(vpToken))
      .expect(403);
  });

  it('enforces contract/document RBAC for a read-only role', async () => {
    // VicePrincipal has neither hr:contract:read nor hr:document:read.
    await http().get(`/api/v1/employees/${employeeId}/contracts`).set(auth(vpToken)).expect(403);
    await http().get(`/api/v1/employees/${employeeId}/documents`).set(auth(vpToken)).expect(403);
    // …but may read non-sensitive personal records (employee:read).
    await http()
      .get(`/api/v1/employees/${employeeId}/emergency-contacts`)
      .set(auth(vpToken))
      .expect(200);
  });
});

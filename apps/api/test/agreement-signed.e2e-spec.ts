/**
 * End-to-end tests for the refined Registration Agreement: exactly ONE immutable agreement per
 * enrollment (no versioning), and signed-copy support (upload / replace / view / delete) that reuses
 * the object-storage service, enforces the new RBAC permissions, keeps tenant isolation on the
 * storage key, and audits every action.
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

const TENANT = 'aaaa1111-aaaa-1111-aaaa-111111111111';
const OTHER_TENANT = 'bbbb2222-bbbb-2222-bbbb-222222222222';
const PASSWORD = 'Sup3rSecret!';

describe('Registration Agreement — signed copy + one-per-enrollment (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let registrarToken: string; // generate + upload + replace + delete
  let accountantToken: string; // upload + replace, but NOT delete
  let teacherToken: string; // no document permissions
  let enrollmentId: string;

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
      for (const id of [TENANT, OTHER_TENANT]) {
        await tx.tenant.deleteMany({ where: { id } });
        await tx.tenant.create({ data: { id, name: id, slug: id, status: 'ACTIVE' } });
        await rbac.provisionTenantRoles(tx, id);
      }

      const school = await tx.school.create({
        data: { tenantId: TENANT, nameEn: 'S', nameAr: 'س' },
      });
      const campus = await tx.campus.create({
        data: { tenantId: TENANT, schoolId: school.id, nameEn: 'C', nameAr: 'ج' },
      });
      const academicYear = await tx.academicYear.create({
        data: {
          tenantId: TENANT,
          campusId: campus.id,
          name: '2026/2027',
          startDate: new Date('2026-09-01'),
          endDate: new Date('2027-06-30'),
          isCurrent: true,
        },
      });
      const grade = await tx.grade.create({
        data: {
          tenantId: TENANT,
          campusId: campus.id,
          nameEn: 'Grade 1',
          nameAr: 'الأول',
          level: 1,
        },
      });
      const student = await tx.student.create({
        data: {
          tenantId: TENANT,
          firstNameEn: 'Lina',
          lastNameEn: 'H',
          firstNameAr: 'لينا',
          lastNameAr: 'ح',
          qrCode: `QR-${TENANT}`,
        },
      });
      const quote = await tx.enrollmentQuote.create({
        data: {
          tenantId: TENANT,
          academicYearId: academicYear.id,
          gradeId: grade.id,
          studentId: student.id,
          paymentMode: 'INSTALLMENTS',
          installments: 4,
          firstDueDate: new Date('2026-09-01'),
          totalFees: 1200,
          discountEligible: 1000,
          discountAmount: 0,
          nonDiscountEligible: 200,
          grandTotal: 1200,
          items: {
            create: [
              {
                tenantId: TENANT,
                kind: 'TUITION',
                label: 'Tuition',
                amount: 1000,
                discountable: true,
              },
              { tenantId: TENANT, kind: 'TRANSPORT', label: 'Transport', amount: 200 },
            ],
          },
        },
      });
      const enrollment = await tx.enrollment.create({
        data: {
          tenantId: TENANT,
          studentId: student.id,
          academicYearId: academicYear.id,
          gradeId: grade.id,
          quoteId: quote.id,
          paymentMode: 'INSTALLMENTS',
          status: 'COMMITTED',
        },
      });
      enrollmentId = enrollment.id;

      const mkUser = async (email: string, role: RoleKey) => {
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
      await mkUser('registrar@agr.example', RoleKey.Registrar);
      await mkUser('accountant@agr.example', RoleKey.Accountant);
      await mkUser('teacher@agr.example', RoleKey.Teacher);
    });

    registrarToken = await login('registrar@agr.example');
    accountantToken = await login('accountant@agr.example');
    teacherToken = await login('teacher@agr.example');
  });

  afterAll(async () => {
    await withPlatform(prisma, async (tx) => {
      await tx.tenant.deleteMany({ where: { id: { in: [TENANT, OTHER_TENANT] } } });
    });
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: TENANT })
      .expect(200);
    return res.body.accessToken as string;
  }

  let agreementId: string;

  it('generates exactly ONE agreement per enrollment; re-generating is idempotent (no versioning)', async () => {
    const first = await http()
      .post('/api/v1/documents/agreements')
      .set(auth(registrarToken))
      .send({ enrollmentId, language: 'EN' })
      .expect(201);
    const firstNo = first.body.agreement.agreementNo as number;
    agreementId = first.body.agreement.id as string;
    expect(first.body.agreement.version).toBe(1);

    // Re-generating returns the SAME agreement — never a new version.
    const second = await http()
      .post('/api/v1/documents/agreements')
      .set(auth(registrarToken))
      .send({ enrollmentId, language: 'EN' })
      .expect(201);
    expect(second.body.agreement.agreementNo).toBe(firstNo);
    expect(second.body.agreement.id).toBe(agreementId);

    // Exactly one agreement row exists for the enrollment.
    const rows = await withPlatform(prisma, (tx) =>
      tx.registrationAgreement.count({ where: { tenantId: TENANT, enrollmentId } }),
    );
    expect(rows).toBe(1);

    const list = await http()
      .get(`/api/v1/documents/agreements?enrollmentId=${enrollmentId}`)
      .set(auth(registrarToken))
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].effectiveStatus).toBe('GENERATED');
    expect(list.body[0].hasSigned).toBe(false);
  });

  /** Presign a signed-copy upload and return the tenant-scoped fileKey the API issued. */
  async function presignKey(token: string, fileName = 'signed.pdf'): Promise<string> {
    const res = await http()
      .post(`/api/v1/documents/agreements/${agreementId}/signed/presign`)
      .set(auth(token))
      .send({ fileName, contentType: 'application/pdf', size: 4096 })
      .expect(201);
    return res.body.fileKey as string;
  }

  it('rejects a signed upload with a cross-tenant storage key (tenant isolation)', async () => {
    await http()
      .post(`/api/v1/documents/agreements/${agreementId}/signed`)
      .set(auth(registrarToken))
      .send({
        fileKey: `tenants/${OTHER_TENANT}/agreements-signed/x.pdf`,
        fileName: 'x.pdf',
        contentType: 'application/pdf',
      })
      .expect(403);
  });

  it('rejects a non-PDF/JPG/PNG signed upload at presign', async () => {
    await http()
      .post(`/api/v1/documents/agreements/${agreementId}/signed/presign`)
      .set(auth(registrarToken))
      .send({ fileName: 'x.docx', contentType: 'application/msword', size: 100 })
      .expect(400);
  });

  it('uploads the signed copy → status SIGNED, reference stored (no bytes in the DB)', async () => {
    const fileKey = await presignKey(registrarToken);
    await http()
      .post(`/api/v1/documents/agreements/${agreementId}/signed`)
      .set(auth(registrarToken))
      .send({
        fileKey,
        fileName: 'signed.pdf',
        contentType: 'application/pdf',
        size: 4096,
        signedBy: 'Parent Name',
        signedAt: '2026-09-05',
      })
      .expect(201);

    const row = await withPlatform(prisma, (tx) =>
      tx.registrationAgreement.findFirst({ where: { id: agreementId } }),
    );
    expect(row?.status).toBe('SIGNED');
    expect(row?.signedFileKey).toBe(fileKey);
    expect(row?.signedBy).toBe('Parent Name');

    const list = await http()
      .get(`/api/v1/documents/agreements?enrollmentId=${enrollmentId}`)
      .set(auth(registrarToken))
      .expect(200);
    expect(list.body[0].effectiveStatus).toBe('SIGNED');
    expect(list.body[0].hasSigned).toBe(true);
    expect(list.body[0].signedUploadedByName).toBeTruthy();
  });

  it('rejects a first-upload over an already-signed agreement (must use replace)', async () => {
    const fileKey = await presignKey(registrarToken);
    await http()
      .post(`/api/v1/documents/agreements/${agreementId}/signed`)
      .set(auth(registrarToken))
      .send({ fileKey, fileName: 'again.pdf', contentType: 'application/pdf' })
      .expect(409);
  });

  it('replaces the signed copy (DOCUMENT_REPLACE_SIGNED)', async () => {
    const fileKey = await presignKey(registrarToken, 'signed-v2.pdf'); // gitleaks:allow (test file name, not a secret)
    await http()
      .put(`/api/v1/documents/agreements/${agreementId}/signed`)
      .set(auth(registrarToken))
      .send({ fileKey, fileName: 'signed-v2.pdf', contentType: 'application/pdf', size: 2048 })
      .expect(200);
    const row = await withPlatform(prisma, (tx) =>
      tx.registrationAgreement.findFirst({ where: { id: agreementId } }),
    );
    expect(row?.signedFileName).toBe('signed-v2.pdf');
    expect(row?.status).toBe('SIGNED');
  });

  it('issues a secure view URL for the signed copy (audited)', async () => {
    const res = await http()
      .get(`/api/v1/documents/agreements/${agreementId}/signed`)
      .set(auth(registrarToken))
      .expect(200);
    expect(typeof res.body.url).toBe('string');
    expect(res.body.url.length).toBeGreaterThan(0);
  });

  it('enforces RBAC: a Teacher cannot upload; an Accountant cannot delete', async () => {
    // Teacher has no signed permissions at all.
    await http()
      .post(`/api/v1/documents/agreements/${agreementId}/signed/presign`)
      .set(auth(teacherToken))
      .send({ fileName: 's.pdf', contentType: 'application/pdf', size: 10 })
      .expect(403);
    // Accountant may upload/replace but NOT delete.
    await http()
      .delete(`/api/v1/documents/agreements/${agreementId}/signed`)
      .set(auth(accountantToken))
      .expect(403);
    const okReplaceKey = await presignKey(accountantToken, 'acct.pdf');
    await http()
      .put(`/api/v1/documents/agreements/${agreementId}/signed`)
      .set(auth(accountantToken))
      .send({ fileKey: okReplaceKey, fileName: 'acct.pdf', contentType: 'application/pdf' })
      .expect(200);
  });

  it('deletes the signed copy (DOCUMENT_DELETE_SIGNED) → back to GENERATED', async () => {
    await http()
      .delete(`/api/v1/documents/agreements/${agreementId}/signed`)
      .set(auth(registrarToken))
      .expect(200);
    const row = await withPlatform(prisma, (tx) =>
      tx.registrationAgreement.findFirst({ where: { id: agreementId } }),
    );
    expect(row?.signedFileKey).toBeNull();
    expect(row?.status).toBe('GENERATED');
  });

  it('audits every signed-copy action', async () => {
    const actions = await withPlatform(prisma, (tx) =>
      tx.auditLog.findMany({
        where: { tenantId: TENANT, action: { startsWith: 'document.registrationAgreement.sign' } },
        select: { action: true },
      }),
    );
    const set = new Set(actions.map((a) => a.action));
    expect([...set]).toEqual(
      expect.arrayContaining([
        'document.registrationAgreement.signUpload',
        'document.registrationAgreement.signReplace',
        'document.registrationAgreement.signView',
        'document.registrationAgreement.signDelete',
      ]),
    );
  });
});

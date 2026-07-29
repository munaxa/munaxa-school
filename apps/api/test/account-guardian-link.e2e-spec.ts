/**
 * Assigning a guardian places the student under that guardian's Financial Account (e2e).
 *
 *  1. A guardian-less student is findable in Finance search (returned as a student hit, no account).
 *  2. Linking a parent (People module) back-links the student's financial account to the guardian's
 *     Payer, so the student then appears under the account (byParent) — and a family payment
 *     allocates across the account's students.
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

const TENANT = 'dddd9999-dddd-9999-dddd-999999999999';
const PASSWORD = 'Sup3rSecret!';

describe('Guardian link → Financial Account (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let studentId: string;
  let parentId: string;

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
        data: { id: TENANT, name: 'gl', slug: 'gl', status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT);
      const u = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'admin@gl.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      // SchoolAdmin ('*') covers both STUDENT_MANAGE (link) and FINANCE_* (search / account).
      await rbac.assignRole(tx, TENANT, u.id, RoleKey.SchoolAdmin);

      studentId = (
        await tx.student.create({
          data: {
            tenantId: TENANT,
            firstNameEn: 'Omar',
            lastNameEn: 'Haddad',
            firstNameAr: 'عمر',
            lastNameAr: 'حداد',
            qrCode: `QR-${TENANT}-omar`,
          },
        })
      ).id;
      parentId = (
        await tx.parent.create({
          data: {
            tenantId: TENANT,
            firstNameEn: 'Tamer',
            lastNameEn: 'Haddad',
            firstNameAr: 'تامر',
            lastNameAr: 'حداد',
            phone: '+962790002222',
          },
        })
      ).id;
    });

    token = (
      await http()
        .post('/api/v1/auth/login')
        .send({ email: 'admin@gl.example', password: PASSWORD, tenantSlug: 'gl' })
        .expect(200)
    ).body.accessToken as string;
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  it('finds a guardian-less student in Finance search (student hit, no account)', async () => {
    const res = await http().get('/api/v1/finance/families/search?q=Omar').set(auth()).expect(200);
    const hit = (
      res.body as Array<{ studentId: string | null; financialAccountId: string | null }>
    ).find((h) => h.studentId === studentId);
    expect(hit).toBeDefined();
    expect(hit!.financialAccountId).toBeNull();
  });

  it('linking the guardian places the student under the guardian’s account', async () => {
    await http()
      .post(`/api/v1/students/${studentId}/parents`)
      .set(auth())
      .send({ parentId, relation: 'FATHER', isPrimary: true })
      .expect(201);

    // The guardian now has an account (Payer) and the student is billed through it.
    const byParent = await http()
      .get(`/api/v1/finance/families/by-parent/${parentId}`)
      .set(auth())
      .expect(200);
    expect(byParent.body.account).not.toBeNull();
    const studentIds = (byParent.body.students as Array<{ studentId: string }>).map(
      (s) => s.studentId,
    );
    expect(studentIds).toContain(studentId);

    // The student's financial account is now linked to the guardian's Payer.
    await withPlatform(prisma, async (tx) => {
      const acct = await tx.studentFinancialAccount.findFirst({ where: { studentId } });
      const payer = await tx.payer.findFirst({ where: { tenantId: TENANT, parentId } });
      expect(acct?.payerId).toBe(payer?.id);
    });

    // The student now searches THROUGH the guardian account (no longer a guardian-less hit).
    const res = await http().get('/api/v1/finance/families/search?q=Tamer').set(auth()).expect(200);
    const parentHit = (res.body as Array<{ parentId: string | null; studentCount: number }>).find(
      (h) => h.parentId === parentId,
    );
    expect(parentHit).toBeDefined();
    expect(parentHit!.studentCount).toBe(1);
  });

  it('a soft-deleted student no longer appears under the account', async () => {
    await withPlatform(prisma, (tx) =>
      tx.student.update({ where: { id: studentId }, data: { deletedAt: new Date() } }),
    );
    const byParent = await http()
      .get(`/api/v1/finance/families/by-parent/${parentId}`)
      .set(auth())
      .expect(200);
    const studentIds = (byParent.body.students as Array<{ studentId: string }>).map(
      (s) => s.studentId,
    );
    expect(studentIds).not.toContain(studentId);
  });
});

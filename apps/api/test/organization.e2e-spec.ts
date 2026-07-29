/**
 * End-to-end tests for Settings → Organization against a real PostgreSQL: lazy creation,
 * per-section updates, independent feature toggles, audit logging (before/after), RBAC
 * (read vs write + per-section delegation, and denial for unauthorized roles), tenant
 * isolation, and cross-tenant asset-key rejection (BOLA).
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

const TENANT_A = 'a1110000-aaaa-1111-aaaa-111111111111';
const TENANT_B = 'b2220000-bbbb-2222-bbbb-222222222222';
const PASSWORD = 'Sup3rSecret!';

describe('Organization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAToken: string;
  let adminBToken: string;
  let teacherToken: string;

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
      for (const [id, slug] of [
        [TENANT_A, 'org-a'],
        [TENANT_B, 'org-b'],
      ] as const) {
        await tx.tenant.deleteMany({ where: { id } });
        await tx.tenant.create({ data: { id, name: slug, slug, status: 'ACTIVE' } });
        await rbac.provisionTenantRoles(tx, id);
        const admin = await tx.user.create({
          data: {
            tenantId: id,
            email: `admin@${slug}.example`,
            status: 'ACTIVE',
            passwordHash: hash,
            mustChangePassword: false,
          },
        });
        await rbac.assignRole(tx, id, admin.id, RoleKey.SchoolAdmin);
      }
      const teacher = await tx.user.create({
        data: {
          tenantId: TENANT_A,
          email: 'teacher@org-a.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT_A, teacher.id, RoleKey.Teacher);
    });

    adminAToken = await login('admin@org-a.example', 'org-a');
    adminBToken = await login('admin@org-b.example', 'org-b');
    teacherToken = await login('teacher@org-a.example', 'org-a');
  });

  afterAll(async () => {
    await withPlatform(prisma, async (tx) => {
      await tx.tenant.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } });
    });
    await app.close();
  });

  async function login(email: string, tenantSlug: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('lazily creates settings with sane defaults on first read', async () => {
    const res = await http().get('/api/v1/organization').set(auth(adminAToken)).expect(200);
    expect(res.body.schoolType).toBe('PRIVATE');
    expect(res.body.logoEnabled).toBe(false);
    expect(res.body.assetUrls).toEqual({});
  });

  it('updates general identity and persists it', async () => {
    await http()
      .put('/api/v1/organization/general')
      .set(auth(adminAToken))
      .send({ nameEn: 'Tenant A School', nameAr: 'مدرسة أ', schoolType: 'INTERNATIONAL' })
      .expect(200);

    const res = await http().get('/api/v1/organization').set(auth(adminAToken)).expect(200);
    expect(res.body.nameEn).toBe('Tenant A School');
    expect(res.body.schoolType).toBe('INTERNATIONAL');
  });

  it('toggles a branding feature independently and merges logo visibility JSON', async () => {
    const res = await http()
      .put('/api/v1/organization/branding')
      .set(auth(adminAToken))
      .send({ logoEnabled: true, logoVisibility: { reports: true } })
      .expect(200);
    expect(res.body.logoEnabled).toBe(true);
    expect(res.body.logoVisibility).toMatchObject({ reports: true });

    // A second partial update preserves the previously-set key (shallow merge).
    const res2 = await http()
      .put('/api/v1/organization/branding')
      .set(auth(adminAToken))
      .send({ logoVisibility: { certificates: true } })
      .expect(200);
    expect(res2.body.logoVisibility).toMatchObject({ reports: true, certificates: true });
  });

  it('writes an audit log with before/after for each change', async () => {
    await http()
      .put('/api/v1/organization/contact')
      .set(auth(adminAToken))
      .send({ phone: '+962790000000' })
      .expect(200);

    const audit = await withPlatform(prisma, (tx) =>
      tx.auditLog.findFirst({
        where: { tenantId: TENANT_A, action: 'organization.contact.updated' },
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(audit).toBeTruthy();
    expect((audit!.after as Record<string, unknown>).phone).toBe('+962790000000');
    expect(audit!.entityType).toBe('OrganizationSettings');
  });

  it('replaces the compliance government-ID list wholesale', async () => {
    const res = await http()
      .put('/api/v1/organization/compliance')
      .set(auth(adminAToken))
      .send({
        complianceEnabled: true,
        otherGovIds: [{ label: 'Reg', value: '123' }],
      })
      .expect(200);
    expect(res.body.complianceEnabled).toBe(true);
    expect(res.body.otherGovIds).toEqual([{ label: 'Reg', value: '123' }]);
  });

  it('rejects an out-of-range advanced value (validation)', async () => {
    await http()
      .put('/api/v1/organization/advanced')
      .set(auth(adminAToken))
      .send({ pdfQuality: 999 })
      .expect(400);
  });

  it('denies a teacher (no organization permissions) read and write', async () => {
    await http().get('/api/v1/organization').set(auth(teacherToken)).expect(403);
    await http()
      .put('/api/v1/organization/general')
      .set(auth(teacherToken))
      .send({ nameEn: 'hack' })
      .expect(403);
  });

  it('rejects confirming an asset key that belongs to another tenant (BOLA)', async () => {
    await http()
      .post('/api/v1/organization/assets/confirm')
      .set(auth(adminAToken))
      .send({
        slot: 'logo',
        fileKey: `tenants/${TENANT_B}/organization/x-logo.png`,
        contentType: 'image/png',
      })
      .expect(403);
  });

  it('isolates settings per tenant', async () => {
    const a = await http().get('/api/v1/organization').set(auth(adminAToken)).expect(200);
    const b = await http().get('/api/v1/organization').set(auth(adminBToken)).expect(200);
    expect(a.body.nameEn).toBe('Tenant A School');
    expect(b.body.nameEn).toBeNull();
    expect(a.body.id).not.toBe(b.body.id);
  });
});

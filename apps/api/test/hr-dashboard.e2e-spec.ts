/**
 * End-to-end tests for HR Phase 10 (HR dashboard, alerts & reporting): the aggregate KPI dashboard,
 * the actionable alerts feed (expiring documents/probation), the roster CSV export, and RBAC.
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

const TENANT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PASSWORD = 'Sup3rSecret!';

describe('HR dashboard & alerts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let teacherToken: string; // no hr:dashboard:read

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
        data: { id: TENANT, name: 'hrdash', slug: 'hrdash', status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT);
      for (const [email, role] of [
        ['admin@hrdash.example', RoleKey.SchoolAdmin],
        ['teacher@hrdash.example', RoleKey.Teacher],
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

    adminToken = await login('admin@hrdash.example');
    teacherToken = await login('teacher@hrdash.example');

    // An employee on probation ending within the alert window.
    const soon = new Date();
    soon.setUTCDate(soon.getUTCDate() + 15);
    await http()
      .post('/api/v1/employees')
      .set(auth(adminToken))
      .send({
        firstNameEn: 'Dana',
        lastNameEn: 'Sami',
        firstNameAr: 'دانا',
        lastNameAr: 'سامي',
        jobTitle: 'Teacher',
        status: 'PROBATION',
        probationEndDate: soon.toISOString().slice(0, 10),
      })
      .expect(201);
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.deleteMany({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'hrdash' })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('returns an aggregate dashboard payload', async () => {
    const res = await http().get('/api/v1/hr/dashboard').set(auth(adminToken)).expect(200);
    expect(res.body.headcount.total).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.headcount.byStatus)).toBe(true);
    expect(res.body.expiring.probation).toBeGreaterThanOrEqual(1);
    expect(res.body).toHaveProperty('assets');
    expect(res.body).toHaveProperty('recruitment');
  });

  it('surfaces the probation-ending item in the alerts feed with a severity', async () => {
    const res = await http()
      .get('/api/v1/hr/dashboard/alerts?within=30')
      .set(auth(adminToken))
      .expect(200);
    const probation = res.body.find((a: { type: string }) => a.type === 'probation');
    expect(probation).toBeTruthy();
    expect(probation.severity).toBe('due_soon');
    expect(probation.daysRemaining).toBeGreaterThan(0);
    expect(probation.employeeName).toContain('Dana');
  });

  it('exports the headcount roster as CSV', async () => {
    const res = await http()
      .get('/api/v1/hr/dashboard/roster/export?format=csv')
      .set(auth(adminToken))
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('hr-roster');
    expect(res.text).toContain('Dana Sami');
  });

  it('enforces RBAC', async () => {
    await http().get('/api/v1/hr/dashboard').set(auth(teacherToken)).expect(403);
    await http().get('/api/v1/hr/dashboard/alerts').set(auth(teacherToken)).expect(403);
  });
});

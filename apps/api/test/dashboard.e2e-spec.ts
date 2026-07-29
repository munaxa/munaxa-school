/**
 * End-to-end test for the admin dashboard overview aggregate (KPIs + recent activity + RBAC).
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

const TENANT = 'da58b0a4-7777-4777-8777-777777777777';
const PASSWORD = 'Sup3rSecret!';

describe('Dashboard overview (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string; // no report:read

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
        data: { id: TENANT, name: 'dash', slug: 'dash', status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT);
      const student = await tx.student.create({
        data: {
          tenantId: TENANT,
          firstNameEn: 'D',
          lastNameEn: 'S',
          firstNameAr: 'د',
          lastNameAr: 'س',
          qrCode: `QR-${TENANT}`,
        },
      });
      const dashAccount = await tx.studentFinancialAccount.create({
        data: { tenantId: TENANT, studentId: student.id },
      });
      const dashCharge = await tx.charge.create({
        data: {
          tenantId: TENANT,
          accountId: dashAccount.id,
          studentId: student.id,
          description: 'Tuition',
          amount: '1000.000',
          status: 'PENDING',
        },
      });
      await tx.installment.create({
        data: { tenantId: TENANT, chargeId: dashCharge.id, seq: 1, amount: '1000.000' },
      });
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
      await mk('admin@dash.example', RoleKey.SchoolAdmin);
      await mk('student@dash.example', RoleKey.Student);
    });

    adminToken = await login('admin@dash.example');
    studentToken = await login('student@dash.example');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'dash' })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('returns tenant KPIs for an admin', async () => {
    const res = await http().get('/api/v1/dashboard/overview').set(auth(adminToken)).expect(200);
    expect(res.body.students).toBeGreaterThanOrEqual(1);
    expect(res.body.finance.billed).toBe('1000.000');
    expect(res.body.finance.outstanding).toBe('1000.000');
    expect(res.body.attendanceToday).toHaveProperty('present');
    expect(Array.isArray(res.body.recentActivity)).toBe(true);
    expect(res.body.einvoice).toHaveProperty('pending');
  });

  it('blocks a role without report:read', async () => {
    await http().get('/api/v1/dashboard/overview').set(auth(studentToken)).expect(403);
  });
});

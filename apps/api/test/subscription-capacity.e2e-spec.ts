/**
 * The plan's counted limits — students, campuses, staff — against a real PostgreSQL, and above all
 * under concurrency: ten simultaneous requests with room for three must create exactly three. The
 * count and the create share one transaction holding a per-tenant lock (`lockScope`); without it,
 * concurrent requests each see room for the last place. Also: a CSV import is held to the student
 * limit as the form is, and a candidate takes no staff place until hired.
 *
 * Requires a migrated, seeded DB. Run via `pnpm test:e2e`.
 */
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { LimitKey, RoleKey } from '@school/domain';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/services/password.service';
import { RbacService } from '../src/auth/services/rbac.service';
import { SubscriptionService } from '../src/subscription/subscription.service';
import { withPlatform } from '../src/prisma/tenant.helpers';

const TENANT_ID = '55555555-5555-5555-5555-5555555555c1';
const SLUG = 'capacity-e2e';
const EMAIL = 'admin@capacity-e2e.example';
const PASSWORD = 'Sup3rSecret!';

describe('Plan limits under concurrency (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let subscriptions: SubscriptionService;
  let token: string;
  let schoolId: string;

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);
    subscriptions = moduleRef.get(SubscriptionService);
    const passwords = moduleRef.get(PasswordService);
    const rbac = moduleRef.get(RbacService);

    await withPlatform(prisma, async (tx) => {
      await tx.tenant.deleteMany({ where: { id: TENANT_ID } });
      await tx.tenant.create({
        data: { id: TENANT_ID, name: 'Capacity E2E', slug: SLUG, status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT_ID);
      const user = await tx.user.create({
        data: {
          tenantId: TENANT_ID,
          email: EMAIL,
          status: 'ACTIVE',
          mustChangePassword: false,
          passwordHash: await passwords.hash(PASSWORD),
        },
      });
      await rbac.assignRole(tx, TENANT_ID, user.id, RoleKey.SchoolAdmin);
      const plan = await tx.subscriptionPlan.findFirstOrThrow({ orderBy: { sortOrder: 'asc' } });
      await tx.tenantSubscription.create({
        data: { tenantId: TENANT_ID, planId: plan.id, status: 'ACTIVE' },
      });
      const school = await tx.school.create({
        data: { tenantId: TENANT_ID, nameEn: 'Capacity School', nameAr: 'مدرسة' },
      });
      schoolId = school.id;
    });

    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD, tenantSlug: SLUG })
      .expect(200);
    token = login.body.accessToken as string;
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT_ID } }));
    await app.close();
  });

  /** Sets the tenant's limit for `key` to `limit` more than what it already holds. */
  async function roomFor(key: string, extra: number, held: () => Promise<number>) {
    const limitOverride = (await held()) + extra;
    await withPlatform(prisma, (tx) =>
      tx.tenantFeatureOverride.upsert({
        where: { tenantId_key: { tenantId: TENANT_ID, key } },
        create: { tenantId: TENANT_ID, key, limitOverride },
        update: { limitOverride },
      }),
    );
    subscriptions.invalidate(TENANT_ID);
    return limitOverride;
  }

  const count = {
    students: () =>
      withPlatform(prisma, (tx) =>
        tx.student.count({ where: { tenantId: TENANT_ID, deletedAt: null } }),
      ),
    campuses: () =>
      withPlatform(prisma, (tx) =>
        tx.campus.count({ where: { tenantId: TENANT_ID, deletedAt: null } }),
      ),
    staff: () =>
      withPlatform(prisma, (tx) =>
        tx.employee.count({
          where: {
            tenantId: TENANT_ID,
            deletedAt: null,
            status: {
              in: [
                'HIRED',
                'PROBATION',
                'ACTIVE',
                'TRANSFERRED',
                'PROMOTION',
                'ON_LEAVE',
                'SUSPENDED',
              ],
            },
          },
        }),
      ),
  };

  const student = (n: number) => ({
    firstNameEn: `Race${n}`,
    lastNameEn: 'Student',
    firstNameAr: 'سباق',
    lastNameAr: 'طالب',
  });
  const employee = (n: number, status: string) => ({
    firstNameEn: `Race${n}`,
    lastNameEn: 'Staff',
    firstNameAr: 'سباق',
    lastNameAr: 'موظف',
    jobTitle: 'Teacher',
    status,
  });

  /** Fires every request at once and returns their status codes. */
  async function race(send: (n: number) => request.Test, n = 10): Promise<number[]> {
    const answers = await Promise.all(Array.from({ length: n }, (_, i) => send(i)));
    return answers.map((answer) => answer.status);
  }

  it('ten simultaneous students with room for three create exactly three', async () => {
    const limit = await roomFor(LimitKey.STUDENTS, 3, count.students);
    const statuses = await race((n) =>
      http().post('/api/v1/students').set(auth()).send(student(n)),
    );
    expect(statuses.filter((s) => s === 201)).toHaveLength(3);
    expect(statuses.filter((s) => s === 403)).toHaveLength(7);
    await expect(count.students()).resolves.toBe(limit);
  });

  it('holds a CSV import to the student limit: the whole file fits, or nothing is created', async () => {
    const limit = await roomFor(LimitKey.STUDENTS, 2, count.students);
    const csv = [
      'firstNameEn,lastNameEn,firstNameAr,lastNameAr',
      'Csv1,Student,س,ط',
      'Csv2,Student,س,ط',
      'Csv3,Student,س,ط',
    ].join('\n');
    const refused = await http().post('/api/v1/students/import').set(auth()).send({ csv });
    expect(refused.status).toBe(403);
    expect(refused.body.message).toMatch(/student limit/);
    await expect(count.students()).resolves.toBe(limit - 2);

    const fits = csv.split('\n').slice(0, 3).join('\n');
    const imported = await http().post('/api/v1/students/import').set(auth()).send({ csv: fits });
    expect(imported.status).toBe(201);
    expect(imported.body.created).toBe(2);
    await expect(count.students()).resolves.toBe(limit);
  });

  it('ten simultaneous campuses with room for two create exactly two', async () => {
    const limit = await roomFor(LimitKey.CAMPUSES, 2, count.campuses);
    const statuses = await race((n) =>
      http()
        .post('/api/v1/campuses')
        .set(auth())
        .send({ schoolId, nameEn: `Campus ${n}`, nameAr: `حرم ${n}` }),
    );
    expect(statuses.filter((s) => s === 201)).toHaveLength(2);
    await expect(count.campuses()).resolves.toBe(limit);
  });

  it('ten simultaneous hires with room for two hire exactly two; candidates take no place', async () => {
    const limit = await roomFor(LimitKey.STAFF, 2, count.staff);
    const statuses = await race((n) =>
      http().post('/api/v1/employees').set(auth()).send(employee(n, 'ACTIVE')),
    );
    expect(statuses.filter((s) => s === 201)).toHaveLength(2);
    await expect(count.staff()).resolves.toBe(limit);

    // At the limit, a candidate is still welcome: the pipeline is not the staff.
    const candidate = await http()
      .post('/api/v1/employees')
      .set(auth())
      .send(employee(99, 'CANDIDATE'))
      .expect(201);
    const move = (toStatus: string) =>
      http()
        .post(`/api/v1/employees/${candidate.body.id as string}/status`)
        .set(auth())
        .send({ toStatus });
    // Through the pipeline, which is not the staff and takes no place.
    for (const stage of ['INTERVIEW', 'OFFER_SENT', 'OFFER_ACCEPTED']) {
      expect([200, 201]).toContain((await move(stage)).status);
    }
    // Hiring them is joining the staff, and there is no room.
    const hire = await move('HIRED');
    expect(hire.status).toBe(403);
    await expect(count.staff()).resolves.toBe(limit);

    // Room for one more, and the hire goes through.
    await roomFor(LimitKey.STAFF, 1, count.staff);
    expect([200, 201]).toContain((await move('HIRED')).status);
    await expect(count.staff()).resolves.toBe(limit + 1);
  });
});

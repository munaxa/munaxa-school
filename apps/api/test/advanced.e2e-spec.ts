/**
 * End-to-end tests for the Advanced Modules (Phase 14) against a real PostgreSQL: the
 * feature-flag framework (every module OFF by default → 403, then enabled per tenant), plus
 * core flows for Bus Tracking, Library, Inventory, and School Clinic, and RBAC.
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

const TENANT = 'ffff4444-ffff-4444-ffff-444444444444';
const PASSWORD = 'Sup3rSecret!';

describe('Advanced Modules (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let teacherToken: string; // no advanced-module permissions
  let studentId: string;

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
      await tx.tenant.create({ data: { id: TENANT, name: 'adv', slug: 'adv', status: 'ACTIVE' } });
      await rbac.provisionTenantRoles(tx, TENANT);

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
        return u;
      };
      await mkUser('admin@adv.example', RoleKey.SchoolAdmin);
      await mkUser('teacher@adv.example', RoleKey.Teacher);

      const student = await tx.student.create({
        data: {
          tenantId: TENANT,
          firstNameEn: 'Adam',
          lastNameEn: 'Advanced',
          firstNameAr: 'آدم',
          lastNameAr: 'متقدم',
          qrCode: 'adv-qr-1',
        },
      });
      studentId = student.id;
    });

    adminToken = await login('admin@adv.example');
    teacherToken = await login('teacher@adv.example');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'adv' })
      .expect(200);
    return res.body.accessToken as string;
  }

  async function enable(key: string): Promise<void> {
    await http()
      .put(`/api/v1/feature-flags/${key}`)
      .set(auth(adminToken))
      .send({ enabled: true })
      .expect(200);
  }

  // ---- Feature-flag framework -----------------------------------------------
  it('disables every advanced module by default (403 even for an admin with all permissions)', async () => {
    await http().get('/api/v1/bus/routes').set(auth(adminToken)).expect(403);
    await http().get('/api/v1/library/books').set(auth(adminToken)).expect(403);
    await http().get('/api/v1/inventory/items').set(auth(adminToken)).expect(403);
    await http().get('/api/v1/clinic/visits').set(auth(adminToken)).expect(403);
  });

  // ---- Bus tracking ----------------------------------------------------------
  it('runs bus tracking once enabled', async () => {
    await enable('bus_tracking');

    const route = await http()
      .post('/api/v1/bus/routes')
      .set(auth(adminToken))
      .send({ name: 'North Route' })
      .expect(201);

    const bus = await http()
      .post('/api/v1/bus/vehicles')
      .set(auth(adminToken))
      .send({ plateNumber: '21-99999', routeId: route.body.id, capacity: 30 })
      .expect(201);

    const located = await http()
      .post(`/api/v1/bus/vehicles/${bus.body.id}/location`)
      .set(auth(adminToken))
      .send({ lat: 31.95, lng: 35.91 })
      .expect(201);
    expect(located.body.lastLat).toBe(31.95);

    await http()
      .post('/api/v1/bus/assignments')
      .set(auth(adminToken))
      .send({ studentId, routeId: route.body.id })
      .expect(201);

    const buses = await http().get('/api/v1/bus/vehicles').set(auth(adminToken)).expect(200);
    expect(buses.body).toHaveLength(1);
  });

  // ---- Library ---------------------------------------------------------------
  it('checks books out and back in, blocking when no copies remain', async () => {
    await enable('library_management');

    const book = await http()
      .post('/api/v1/library/books')
      .set(auth(adminToken))
      .send({ title: 'Solo Copy', copiesTotal: 1 })
      .expect(201);

    const loan = await http()
      .post('/api/v1/library/loans')
      .set(auth(adminToken))
      .send({ bookId: book.body.id, studentId, dueDate: '2026-07-15' })
      .expect(201);

    // No copies left → 409.
    await http()
      .post('/api/v1/library/loans')
      .set(auth(adminToken))
      .send({ bookId: book.body.id, borrowerName: 'Someone', dueDate: '2026-07-15' })
      .expect(409);

    await http()
      .post(`/api/v1/library/loans/${loan.body.id}/return`)
      .set(auth(adminToken))
      .expect(200);

    // Available again.
    await http()
      .post('/api/v1/library/loans')
      .set(auth(adminToken))
      .send({ bookId: book.body.id, borrowerName: 'Someone', dueDate: '2026-07-15' })
      .expect(201);
  });

  // ---- Inventory -------------------------------------------------------------
  it('tracks stock movements and blocks negative stock', async () => {
    await enable('inventory_management');

    const item = await http()
      .post('/api/v1/inventory/items')
      .set(auth(adminToken))
      .send({ name: 'Markers', quantity: 10, unit: 'box' })
      .expect(201);

    await http()
      .post('/api/v1/inventory/transactions')
      .set(auth(adminToken))
      .send({ itemId: item.body.id, type: 'OUT', quantity: 4 })
      .expect(201);

    // Over-draw → 409.
    await http()
      .post('/api/v1/inventory/transactions')
      .set(auth(adminToken))
      .send({ itemId: item.body.id, type: 'OUT', quantity: 100 })
      .expect(409);

    const items = await http().get('/api/v1/inventory/items').set(auth(adminToken)).expect(200);
    expect(items.body.find((i: { id: string }) => i.id === item.body.id).quantity).toBe(6);
  });

  // ---- Clinic ----------------------------------------------------------------
  it('records clinic visits and a medical record', async () => {
    await enable('school_clinic');

    await http()
      .post('/api/v1/clinic/visits')
      .set(auth(adminToken))
      .send({ studentId, reason: 'Fever', outcome: 'SENT_HOME', temperature: 38.2 })
      .expect(201);

    await http()
      .put(`/api/v1/clinic/students/${studentId}/record`)
      .set(auth(adminToken))
      .send({ bloodType: 'O+', allergies: 'Peanuts' })
      .expect(200);

    const record = await http()
      .get(`/api/v1/clinic/students/${studentId}/record`)
      .set(auth(adminToken))
      .expect(200);
    expect(record.body.bloodType).toBe('O+');

    const visits = await http()
      .get(`/api/v1/clinic/visits?studentId=${studentId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(visits.body).toHaveLength(1);
  });

  // ---- RBAC (distinct from the feature gate) --------------------------------
  it('enforces permissions even when a module is enabled', async () => {
    // bus_tracking is enabled; a Teacher holds no bus permissions → 403.
    await http().get('/api/v1/bus/routes').set(auth(teacherToken)).expect(403);
    await http().post('/api/v1/bus/routes').set(auth(teacherToken)).send({ name: 'x' }).expect(403);
  });

  it('bus:assign grants student assignment but not fleet configuration', async () => {
    // Provision a custom role holding only bus:assign + bus:read and a user carrying it.
    const rbac = app.get(RbacService);
    const passwords = app.get(PasswordService);
    const hash = await passwords.hash(PASSWORD);
    await withPlatform(prisma, async (tx) => {
      const role = await rbac.createCustomRole(tx, TENANT, {
        nameEn: 'Assignment clerk',
        permissions: ['bus:assign', 'bus:read'],
      });
      const u = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'clerk@adv.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.setUserRoles(tx, TENANT, u.id, [role.id]);
    });
    const clerkToken = await login('clerk@adv.example');

    // Cannot reconfigure the fleet…
    await http().post('/api/v1/bus/routes').set(auth(clerkToken)).send({ name: 'x' }).expect(403);
    await http()
      .post('/api/v1/bus/vehicles')
      .set(auth(clerkToken))
      .send({ plateNumber: 'X-1' })
      .expect(403);

    // …but can read and assign students to an existing route.
    const routes = await http().get('/api/v1/bus/routes').set(auth(clerkToken)).expect(200);
    expect(routes.body.length).toBeGreaterThanOrEqual(1);
    await http()
      .post('/api/v1/bus/assignments')
      .set(auth(clerkToken))
      .send({ studentId, routeId: routes.body[0].id })
      .expect(201);
  });
});

/**
 * End-to-end tests for HR Phase 3 (driver refactor): an Employee becomes a driver via a
 * DriverProfile, the /drivers directory lists them, infractions are recorded, and a Bus references
 * the driver Employee (Bus.driverId) — rejecting non-driver employees. Plus per-capability RBAC.
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

const TENANT = '55555555-5555-5555-5555-555555555555';
const PASSWORD = 'Sup3rSecret!';

describe('HR drivers (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let supervisorToken: string; // BusSupervisor: driver:read, no driver:manage
  let driverEmpId: string;
  let plainEmpId: string;

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
        data: { id: TENANT, name: 'hrdrv', slug: 'hrdrv', status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT);
      for (const [email, role] of [
        ['admin@hrdrv.example', RoleKey.SchoolAdmin],
        ['sup@hrdrv.example', RoleKey.BusSupervisor],
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

    adminToken = await login('admin@hrdrv.example');
    supervisorToken = await login('sup@hrdrv.example');

    driverEmpId = await createEmployee('Khaled', 'Driver');
    plainEmpId = await createEmployee('Nadia', 'Clerk');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.deleteMany({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'hrdrv' })
      .expect(200);
    return res.body.accessToken as string;
  }
  async function createEmployee(first: string, jobTitle: string): Promise<string> {
    const res = await http()
      .post('/api/v1/employees')
      .set(auth(adminToken))
      .send({
        firstNameEn: first,
        lastNameEn: 'Test',
        firstNameAr: first,
        lastNameAr: 'تجربة',
        jobTitle,
      })
      .expect(201);
    return res.body.id;
  }

  it('registers an employee as a driver and lists them in the directory', async () => {
    const profile = await http()
      .put(`/api/v1/employees/${driverEmpId}/driver-profile`)
      .set(auth(adminToken))
      .send({ licenseNumber: 'JD-99887', licenseClass: 'D', licenseExpiry: '2028-05-01' })
      .expect(200);
    expect(profile.body.licenseNumber).toBe('JD-99887');
    expect(profile.body.employeeId).toBe(driverEmpId);

    const drivers = await http().get('/api/v1/drivers').set(auth(adminToken)).expect(200);
    const row = drivers.body.find((d: { employeeId: string }) => d.employeeId === driverEmpId);
    expect(row).toBeTruthy();
    expect(row.employee.firstNameEn).toBe('Khaled');
  });

  it('records and lists driver infractions', async () => {
    await http()
      .post(`/api/v1/employees/${driverEmpId}/driver-profile/infractions`)
      .set(auth(adminToken))
      .send({ date: '2026-03-10', type: 'Speeding', severity: 'MAJOR', points: 4 })
      .expect(201);

    const profile = await http()
      .get(`/api/v1/employees/${driverEmpId}/driver-profile`)
      .set(auth(adminToken))
      .expect(200);
    expect(profile.body.infractions).toHaveLength(1);
    expect(profile.body.infractions[0].type).toBe('Speeding');
  });

  it('assigns the driver Employee to a bus and rejects non-driver employees', async () => {
    // Bus tracking is behind a feature flag (off by default) — enable it for this tenant first.
    await http()
      .put('/api/v1/feature-flags/bus_tracking')
      .set(auth(adminToken))
      .send({ enabled: true })
      .expect(200);

    // A bus referencing the driver Employee resolves the driver relation.
    const bus = await http()
      .post('/api/v1/bus/vehicles')
      .set(auth(adminToken))
      .send({ plateNumber: '55-99001', label: 'Bus D1', driverId: driverEmpId })
      .expect(201);
    expect(bus.body.driverId).toBe(driverEmpId);

    const list = await http().get('/api/v1/bus/vehicles').set(auth(adminToken)).expect(200);
    const found = list.body.find((b: { id: string }) => b.id === bus.body.id);
    expect(found.driver.firstNameEn).toBe('Khaled');

    // The driver now shows the bus in the directory.
    const drivers = await http().get('/api/v1/drivers').set(auth(adminToken)).expect(200);
    const row = drivers.body.find((d: { employeeId: string }) => d.employeeId === driverEmpId);
    expect(row.buses.map((b: { plateNumber: string }) => b.plateNumber)).toContain('55-99001');

    // A non-driver employee cannot be assigned.
    await http()
      .post('/api/v1/bus/vehicles')
      .set(auth(adminToken))
      .send({ plateNumber: '55-99002', driverId: plainEmpId })
      .expect(400);
  });

  it('enforces driver RBAC (read vs manage)', async () => {
    // BusSupervisor can read the directory…
    await http().get('/api/v1/drivers').set(auth(supervisorToken)).expect(200);
    // …but cannot register or edit a driver profile.
    await http()
      .put(`/api/v1/employees/${plainEmpId}/driver-profile`)
      .set(auth(supervisorToken))
      .send({ licenseNumber: 'X' })
      .expect(403);
  });
});

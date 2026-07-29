/**
 * End-to-end tests for the HR core (Phase 1) against a real PostgreSQL: employee lifecycle
 * (create → status transitions with history + state-machine enforcement), the organisation engine
 * (departments + positions with headcount/vacancies), and per-capability RBAC.
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

const TENANT = '77777777-7777-7777-7777-777777777777';
const PASSWORD = 'Sup3rSecret!';

describe('HR core (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string; // SchoolAdmin — full HR
  let vpToken: string; // VicePrincipal — employee:read + hr:org:read only

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
      await tx.tenant.create({ data: { id: TENANT, name: 'hr', slug: 'hr', status: 'ACTIVE' } });
      await rbac.provisionTenantRoles(tx, TENANT);

      const admin = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'admin@hr.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT, admin.id, RoleKey.SchoolAdmin);

      const vp = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'vp@hr.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT, vp.id, RoleKey.VicePrincipal);
    });

    adminToken = await login('admin@hr.example');
    vpToken = await login('vp@hr.example');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.deleteMany({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'hr' })
      .expect(200);
    return res.body.accessToken as string;
  }

  const newEmployee = (over: Record<string, unknown> = {}) => ({
    firstNameEn: 'Omar',
    lastNameEn: 'Nasser',
    firstNameAr: 'عمر',
    lastNameAr: 'ناصر',
    jobTitle: 'Lab Technician',
    ...over,
  });

  // ----- Organisation engine ------------------------------------------------
  let departmentId: string;
  let positionId: string;

  it('creates a department and a position (org engine)', async () => {
    const dept = await http()
      .post('/api/v1/hr/departments')
      .set(auth(adminToken))
      .send({ name: 'Science', code: 'SCI' })
      .expect(201);
    expect(dept.body.name).toBe('Science');
    departmentId = dept.body.id;

    const pos = await http()
      .post('/api/v1/hr/positions')
      .set(auth(adminToken))
      .send({ title: 'Senior Lab Technician', departmentId, budgetedHeadcount: 2 })
      .expect(201);
    expect(pos.body.title).toBe('Senior Lab Technician');
    positionId = pos.body.id;
  });

  // ----- Employee create + lifecycle ---------------------------------------
  let employeeId: string;

  it('creates an employee, seeds status history, and reports org headcount', async () => {
    const res = await http()
      .post('/api/v1/employees')
      .set(auth(adminToken))
      .send(
        newEmployee({
          departmentId,
          positionId,
          employmentType: 'FULL_TIME',
          hireDate: '2026-01-15',
          nationalId: '9991112223',
        }),
      )
      .expect(201);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.department.id).toBe(departmentId);
    expect(Array.isArray(res.body.statusHistory)).toBe(true);
    expect(res.body.statusHistory).toHaveLength(1);
    expect(res.body.statusHistory[0].toStatus).toBe('ACTIVE');
    employeeId = res.body.id;

    // Position now shows one filled seat, one vacancy.
    const positions = await http().get('/api/v1/hr/positions').set(auth(adminToken)).expect(200);
    const pos = positions.body.find((p: { id: string }) => p.id === positionId);
    expect(pos.filled).toBe(1);
    expect(pos.vacancies).toBe(1);

    // Department headcount reflects the new hire.
    const departments = await http()
      .get('/api/v1/hr/departments')
      .set(auth(adminToken))
      .expect(200);
    const dept = departments.body.find((d: { id: string }) => d.id === departmentId);
    expect(dept.headcount).toBe(1);
  });

  it('performs a valid lifecycle transition and records history', async () => {
    const res = await http()
      .post(`/api/v1/employees/${employeeId}/status`)
      .set(auth(adminToken))
      .send({ toStatus: 'ON_LEAVE', reason: 'Parental leave' })
      .expect(201);
    expect(res.body.status).toBe('ON_LEAVE');

    const history = await http()
      .get(`/api/v1/employees/${employeeId}/status-history`)
      .set(auth(adminToken))
      .expect(200);
    expect(history.body[0].toStatus).toBe('ON_LEAVE');
    expect(history.body[0].fromStatus).toBe('ACTIVE');
    expect(history.body[0].reason).toBe('Parental leave');
  });

  it('rejects an illegal lifecycle transition via the state machine', async () => {
    // ACTIVE/ON_LEAVE → HIRED is not a legal edge.
    await http()
      .post(`/api/v1/employees/${employeeId}/status`)
      .set(auth(adminToken))
      .send({ toStatus: 'HIRED' })
      .expect(400);
  });

  it('stamps termination date when entering an exit status', async () => {
    // ON_LEAVE → TERMINATED is legal and terminal (→ archive only afterwards).
    const res = await http()
      .post(`/api/v1/employees/${employeeId}/status`)
      .set(auth(adminToken))
      .send({ toStatus: 'TERMINATED', reason: 'End of contract', effectiveDate: '2026-06-30' })
      .expect(201);
    expect(res.body.status).toBe('TERMINATED');
    expect(res.body.terminationDate).toBeTruthy();
  });

  // ----- RBAC ---------------------------------------------------------------
  it('redacts sensitive fields from callers without hr:sensitive:read', async () => {
    // Admin (SchoolAdmin '*') sees the national ID…
    const asAdmin = await http()
      .get(`/api/v1/employees/${employeeId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(asAdmin.body.nationalId).toBe('9991112223');

    // …VicePrincipal (employee:read, no hr:sensitive:read) gets it nulled.
    const asVp = await http().get(`/api/v1/employees/${employeeId}`).set(auth(vpToken)).expect(200);
    expect(asVp.body.nationalId).toBeNull();
  });

  it('lets a read-only role view but not manage or transition', async () => {
    // VicePrincipal can read the directory…
    await http().get('/api/v1/employees').set(auth(vpToken)).expect(200);
    // …but cannot create employees…
    await http().post('/api/v1/employees').set(auth(vpToken)).send(newEmployee()).expect(403);
    // …and cannot drive the lifecycle.
    await http()
      .post(`/api/v1/employees/${employeeId}/status`)
      .set(auth(vpToken))
      .send({ toStatus: 'ARCHIVED' })
      .expect(403);
  });

  it('rejects creating an employee at a non-entry status', async () => {
    await http()
      .post('/api/v1/employees')
      .set(auth(adminToken))
      .send(newEmployee({ status: 'ON_LEAVE' }))
      .expect(400);
  });
});

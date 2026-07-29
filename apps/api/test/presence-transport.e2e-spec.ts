/**
 * End-to-end tests for Campus Presence + Transportation (Phase 21): event creation, idempotent
 * offline replay (clientRef), the configurable attendance-source engine (arrival → PRESENT, never
 * overwriting a teacher mark), the unified student timeline, and RBAC. Academic Attendance is
 * untouched — its suite must remain green.
 */
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/services/password.service';
import { RbacService } from '../src/auth/services/rbac.service';
import { withPlatform, withTenant } from '../src/prisma/tenant.helpers';
import { RoleKey } from '@school/domain';

const TENANT = 'ace0bbb5-6666-4666-8666-666666666666';
const PASSWORD = 'Sup3rSecret!';

describe('Campus Presence + Transportation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let parentToken: string; // presence:read/transport:read but NOT create
  let studentId: string;
  let sectionId: string;
  let busId: string;

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
      await tx.tenant.create({ data: { id: TENANT, name: 'pt', slug: 'pt', status: 'ACTIVE' } });
      await rbac.provisionTenantRoles(tx, TENANT);

      const school = await tx.school.create({
        data: { tenantId: TENANT, nameEn: 'S', nameAr: 'س' },
      });
      const campus = await tx.campus.create({
        data: { tenantId: TENANT, schoolId: school.id, nameEn: 'C', nameAr: 'ج' },
      });
      const grade = await tx.grade.create({
        data: { tenantId: TENANT, campusId: campus.id, nameEn: 'G1', nameAr: 'أول', level: 1 },
      });
      const section = await tx.section.create({
        data: { tenantId: TENANT, gradeId: grade.id, name: 'A' },
      });
      sectionId = section.id;
      const student = await tx.student.create({
        data: {
          tenantId: TENANT,
          sectionId,
          firstNameEn: 'Omar',
          lastNameEn: 'Haddad',
          firstNameAr: 'عمر',
          lastNameAr: 'الحداد',
          qrCode: `QR-${TENANT}-o`,
        },
      });
      studentId = student.id;
      const bus = await tx.bus.create({
        data: { tenantId: TENANT, plateNumber: 'PT-1', label: 'Route 1' },
      });
      busId = bus.id;

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
      await mk('admin@pt.example', RoleKey.SchoolAdmin);
      await mk('parent@pt.example', RoleKey.Parent);
    });

    adminToken = await login('admin@pt.example');
    parentToken = await login('parent@pt.example');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'pt' })
      .expect(200);
    return res.body.accessToken as string;
  }

  // ---- Presence events + idempotency ----------------------------------------

  it('creates a presence event and replays it idempotently by clientRef', async () => {
    const body = {
      studentId,
      eventType: 'RECEPTION_CHECKIN',
      method: 'MANUAL',
      clientRef: 'pres-1',
    };
    const a = await http()
      .post('/api/v1/presence/events')
      .set(auth(adminToken))
      .send(body)
      .expect(201);
    expect(a.body.created).toBe(true);
    const b = await http()
      .post('/api/v1/presence/events')
      .set(auth(adminToken))
      .send(body)
      .expect(201);
    expect(b.body.created).toBe(false); // replay → no duplicate
    expect(b.body.event.id).toBe(a.body.event.id);

    const list = await http()
      .get(`/api/v1/presence/events?studentId=${studentId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(list.body.filter((e: { clientRef: string }) => e.clientRef === 'pres-1')).toHaveLength(
      1,
    );
  });

  // ---- Bus events + idempotency ---------------------------------------------

  it('creates a bus event and replays it idempotently by clientRef', async () => {
    const body = { studentId, busId, eventType: 'BOARD_AM', method: 'NFC', clientRef: 'bus-1' };
    const a = await http()
      .post('/api/v1/transport/events')
      .set(auth(adminToken))
      .send(body)
      .expect(201);
    expect(a.body.created).toBe(true);
    const b = await http()
      .post('/api/v1/transport/events')
      .set(auth(adminToken))
      .send(body)
      .expect(201);
    expect(b.body.created).toBe(false);
    expect(b.body.event.id).toBe(a.body.event.id);
  });

  // ---- Attendance-source engine ---------------------------------------------

  it('TEACHER_ONLY (default): a GATE_IN does NOT create attendance', async () => {
    await http()
      .post('/api/v1/presence/events')
      .set(auth(adminToken))
      .send({ studentId, eventType: 'GATE_IN', method: 'QR', clientRef: 'gate-teacheronly' })
      .expect(201);
    const count = await withTenant(prisma, TENANT, (tx) =>
      tx.studentAttendance.count({ where: { studentId } }),
    );
    expect(count).toBe(0);
  });

  it('GATE_ARRIVAL: a GATE_IN auto-creates a PRESENT mark (via the existing attendance table)', async () => {
    await http()
      .put('/api/v1/attendance/settings')
      .set(auth(adminToken))
      .send({ mode: 'GATE_ARRIVAL', presenceEnabled: true })
      .expect(200);
    await http()
      .post('/api/v1/presence/events')
      .set(auth(adminToken))
      .send({ studentId, eventType: 'GATE_IN', method: 'QR', clientRef: 'gate-present' })
      .expect(201);
    const mark = await withTenant(prisma, TENANT, (tx) =>
      tx.studentAttendance.findFirst({ where: { studentId } }),
    );
    expect(mark?.status).toBe('PRESENT');
    expect(mark?.method).toBe('MANUAL'); // AttendanceMethod unchanged
  });

  it('never overwrites a teacher mark: a prior ABSENT survives a later GATE_IN', async () => {
    // Seed an ABSENT for tomorrow directly (simulating a teacher mark), then a GATE_IN that day.
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const date = new Date(
      Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate()),
    );
    await withTenant(prisma, TENANT, (tx) =>
      tx.studentAttendance.create({
        data: { tenantId: TENANT, studentId, sectionId, date, classNumber: 0, status: 'ABSENT' },
      }),
    );
    await http()
      .post('/api/v1/presence/events')
      .set(auth(adminToken))
      .send({
        studentId,
        eventType: 'GATE_IN',
        method: 'QR',
        occurredAt: tomorrow.toISOString(),
        clientRef: 'gate-nooverwrite',
      })
      .expect(201);
    const mark = await withTenant(prisma, TENANT, (tx) =>
      tx.studentAttendance.findFirst({ where: { studentId, date } }),
    );
    expect(mark?.status).toBe('ABSENT'); // teacher mark preserved
  });

  // ---- Timeline --------------------------------------------------------------

  it('aggregates attendance + presence + bus into a chronological timeline', async () => {
    const res = await http()
      .get(`/api/v1/students/${studentId}/timeline`)
      .set(auth(adminToken))
      .expect(200);
    const sources = new Set(res.body.map((i: { source: string }) => i.source));
    expect(sources.has('PRESENCE')).toBe(true);
    expect(sources.has('BUS')).toBe(true);
    expect(sources.has('ATTENDANCE')).toBe(true);
    // chronological (descending)
    const times = res.body.map((i: { at: string }) => i.at);
    expect(times).toEqual([...times].sort((a, b) => b.localeCompare(a)));
  });

  // ---- Student card registry (Phase 22) -------------------------------------

  let cardId: string;

  it('issues an NFC card, lists it, and rejects a duplicate UID', async () => {
    const res = await http()
      .post('/api/v1/cards')
      .set(auth(adminToken))
      .send({ studentId, cardUid: 'CARD-UID-1', type: 'NFC', label: 'Blue lanyard' })
      .expect(201);
    cardId = res.body.id;
    expect(res.body.status).toBe('ACTIVE');
    await http()
      .post('/api/v1/cards')
      .set(auth(adminToken))
      .send({ studentId, cardUid: 'CARD-UID-1' })
      .expect(409); // duplicate UID
    const list = await http()
      .get(`/api/v1/cards?studentId=${studentId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(list.body.some((c: { id: string }) => c.id === cardId)).toBe(true);
  });

  it('an ACTIVE card resolves an NFC bus event by cardUid (no studentId needed)', async () => {
    const res = await http()
      .post('/api/v1/transport/events')
      .set(auth(adminToken))
      .send({
        cardUid: 'CARD-UID-1',
        busId,
        eventType: 'BOARD_AM',
        method: 'NFC',
        clientRef: 'bus-card-1',
      })
      .expect(201);
    expect(res.body.created).toBe(true);
    expect(res.body.event.studentId).toBe(studentId); // resolved via the registry
  });

  it('marking the card STOLEN stops it resolving (event rejected)', async () => {
    await http()
      .patch(`/api/v1/cards/${cardId}`)
      .set(auth(adminToken))
      .send({ status: 'STOLEN' })
      .expect(200);
    await http()
      .post('/api/v1/transport/events')
      .set(auth(adminToken))
      .send({
        cardUid: 'CARD-UID-1',
        busId,
        eventType: 'BOARD_PM',
        method: 'NFC',
        clientRef: 'bus-card-2',
      })
      .expect(400); // stolen card no longer resolves
  });

  it('reactivating the card lets it resolve again, and delete removes it', async () => {
    await http()
      .patch(`/api/v1/cards/${cardId}`)
      .set(auth(adminToken))
      .send({ status: 'ACTIVE' })
      .expect(200);
    await http()
      .post('/api/v1/presence/events')
      .set(auth(adminToken))
      .send({
        cardUid: 'CARD-UID-1',
        eventType: 'RECEPTION_CHECKIN',
        method: 'NFC',
        clientRef: 'pres-card-1',
      })
      .expect(201);
    await http().delete(`/api/v1/cards/${cardId}`).set(auth(adminToken)).expect(200);
    await http()
      .post('/api/v1/transport/events')
      .set(auth(adminToken))
      .send({ cardUid: 'CARD-UID-1', busId, eventType: 'BOARD_AM', method: 'NFC' })
      .expect(400); // deleted → no longer resolves
  });

  it('blocks card management for a role without card:manage (Parent)', async () => {
    await http()
      .post('/api/v1/cards')
      .set(auth(parentToken))
      .send({ studentId, cardUid: 'CARD-UID-X' })
      .expect(403);
  });

  // ---- RBAC ------------------------------------------------------------------

  it('blocks event creation for a role without the create permission (Parent)', async () => {
    await http()
      .post('/api/v1/presence/events')
      .set(auth(parentToken))
      .send({ studentId, eventType: 'GATE_IN' })
      .expect(403);
    await http()
      .post('/api/v1/transport/events')
      .set(auth(parentToken))
      .send({ studentId, busId, eventType: 'BOARD_AM' })
      .expect(403);
    // …but a parent CAN read the timeline (attendance:read).
    await http().get(`/api/v1/students/${studentId}/timeline`).set(auth(parentToken)).expect(200);
  });
});

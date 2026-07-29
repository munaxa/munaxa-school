/**
 * End-to-end tests for the Parent Portal (Phase 11) against a real PostgreSQL:
 * leave/absence requests + staff approval, PTM slot booking with capacity, the document
 * vault, the multi-child switcher + dashboard, and — critically — row-scoping a parent to
 * their own linked children (rejecting access to non-linked students), plus RBAC.
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

const TENANT = 'cccc1111-cccc-1111-cccc-111111111111';
const PASSWORD = 'Sup3rSecret!';

describe('Parent Portal (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let parentToken: string; // linked to child1 + child2
  let otherParentToken: string; // linked to child3

  let teacherId: string;
  let child1: string;
  let child2: string;
  let child3: string;

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
      await tx.tenant.create({ data: { id: TENANT, name: 'pp', slug: 'pp', status: 'ACTIVE' } });
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

      const admin = await mkUser('admin@pp.example', RoleKey.SchoolAdmin);
      void admin;
      const parentUser = await mkUser('parent@pp.example', RoleKey.Parent);
      const otherParentUser = await mkUser('other@pp.example', RoleKey.Parent);

      const teacher = await tx.teacher.create({
        data: {
          tenantId: TENANT,
          firstNameEn: 'Tina',
          lastNameEn: 'Teacher',
          firstNameAr: 'تينا',
          lastNameAr: 'معلمة',
        },
      });
      teacherId = teacher.id;

      const parentProfile = await tx.parent.create({
        data: {
          tenantId: TENANT,
          userId: parentUser.id,
          firstNameEn: 'Parent',
          lastNameEn: 'One',
          firstNameAr: 'ولي',
          lastNameAr: 'الأمر',
        },
      });
      const otherProfile = await tx.parent.create({
        data: {
          tenantId: TENANT,
          userId: otherParentUser.id,
          firstNameEn: 'Parent',
          lastNameEn: 'Two',
          firstNameAr: 'ولي',
          lastNameAr: 'ثاني',
        },
      });

      const mkStudent = async (n: number) => {
        const s = await tx.student.create({
          data: {
            tenantId: TENANT,
            firstNameEn: `Child${n}`,
            lastNameEn: 'Student',
            firstNameAr: `طفل${n}`,
            lastNameAr: 'طالب',
            qrCode: `pp-qr-${n}`,
          },
        });
        return s.id;
      };
      child1 = await mkStudent(1);
      child2 = await mkStudent(2);
      child3 = await mkStudent(3);

      await tx.parentStudent.createMany({
        data: [
          {
            tenantId: TENANT,
            parentId: parentProfile.id,
            studentId: child1,
            relation: 'FATHER',
            isPrimary: true,
          },
          { tenantId: TENANT, parentId: parentProfile.id, studentId: child2, relation: 'FATHER' },
          {
            tenantId: TENANT,
            parentId: otherProfile.id,
            studentId: child3,
            relation: 'MOTHER',
            isPrimary: true,
          },
        ],
      });
    });

    adminToken = await login('admin@pp.example');
    parentToken = await login('parent@pp.example');
    otherParentToken = await login('other@pp.example');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'pp' })
      .expect(200);
    return res.body.accessToken as string;
  }

  // ---- Multi-child switcher --------------------------------------------------
  it('lists the parent linked children (multi-child switcher)', async () => {
    const res = await http().get('/api/v1/parent/children').set(auth(parentToken)).expect(200);
    const ids = (res.body as Array<{ studentId: string }>).map((c) => c.studentId).sort();
    expect(ids).toEqual([child1, child2].sort());
  });

  // ---- Leave requests --------------------------------------------------------
  let leaveId: string;
  it('lets a parent submit a leave request for their child', async () => {
    const res = await http()
      .post('/api/v1/leave-requests')
      .set(auth(parentToken))
      .send({
        studentId: child1,
        type: 'LEAVE',
        startDate: '2026-07-01',
        endDate: '2026-07-03',
        reason: 'Family travel',
      })
      .expect(201);
    expect(res.body.status).toBe('PENDING');
    leaveId = res.body.id;
  });

  it('rejects a leave request for a non-linked child (row-scoping)', async () => {
    await http()
      .post('/api/v1/leave-requests')
      .set(auth(parentToken))
      .send({
        studentId: child3,
        type: 'ABSENCE',
        startDate: '2026-07-01',
        endDate: '2026-07-01',
        reason: 'not my child',
      })
      .expect(403);
  });

  it('scopes the parent list to their own children but shows staff the full queue', async () => {
    const parentList = await http()
      .get('/api/v1/leave-requests')
      .set(auth(parentToken))
      .expect(200);
    expect(parentList.body).toHaveLength(1);

    const otherList = await http()
      .get('/api/v1/leave-requests')
      .set(auth(otherParentToken))
      .expect(200);
    expect(otherList.body).toHaveLength(0);

    const staffList = await http()
      .get('/api/v1/leave-requests?status=PENDING')
      .set(auth(adminToken))
      .expect(200);
    expect(staffList.body.length).toBeGreaterThanOrEqual(1);
  });

  it('lets staff approve, blocks parents, and rejects deciding a non-pending request', async () => {
    await http()
      .post(`/api/v1/leave-requests/${leaveId}/decision`)
      .set(auth(parentToken))
      .send({ decision: 'APPROVED' })
      .expect(403);

    await http()
      .post(`/api/v1/leave-requests/${leaveId}/decision`)
      .set(auth(adminToken))
      .send({ decision: 'APPROVED', reviewNote: 'OK' })
      .expect(200);

    // Business rule: cannot decide an already-decided request.
    await http()
      .post(`/api/v1/leave-requests/${leaveId}/decision`)
      .set(auth(adminToken))
      .send({ decision: 'REJECTED' })
      .expect(400);
  });

  // ---- PTM booking -----------------------------------------------------------
  let slotId: string;
  it('lets staff open a PTM slot and a parent book it for their child', async () => {
    const slot = await http()
      .post('/api/v1/ptm/slots')
      .set(auth(adminToken))
      .send({
        teacherId,
        startsAt: '2026-07-10T09:00:00.000Z',
        endsAt: '2026-07-10T09:15:00.000Z',
        location: 'Room 1',
        capacity: 1,
      })
      .expect(201);
    slotId = slot.body.id;

    const booking = await http()
      .post('/api/v1/ptm/bookings')
      .set(auth(parentToken))
      .send({ slotId, studentId: child1 })
      .expect(201);
    expect(booking.body.status).toBe('BOOKED');
  });

  it('returns 409 when booking a full slot and 403 for a non-linked child', async () => {
    await http()
      .post('/api/v1/ptm/bookings')
      .set(auth(otherParentToken))
      .send({ slotId, studentId: child3 })
      .expect(409); // capacity exhausted / slot no longer OPEN

    // A parent cannot book for a child that is not theirs.
    await http()
      .post('/api/v1/ptm/bookings')
      .set(auth(parentToken))
      .send({ slotId, studentId: child3 })
      .expect(403);
  });

  it('blocks parents from creating PTM slots (RBAC)', async () => {
    await http()
      .post('/api/v1/ptm/slots')
      .set(auth(parentToken))
      .send({
        teacherId,
        startsAt: '2026-07-11T09:00:00.000Z',
        endsAt: '2026-07-11T09:15:00.000Z',
      })
      .expect(403);
  });

  // ---- Document vault --------------------------------------------------------
  it('runs the document vault flow scoped to the child', async () => {
    const presign = await http()
      .post('/api/v1/parent-portal/documents/presign')
      .set(auth(parentToken))
      .send({ studentId: child1, fileName: 'report.pdf', contentType: 'application/pdf' })
      .expect(200);
    expect(presign.body.fileKey).toContain(`documents/${child1}`);

    const confirm = await http()
      .post('/api/v1/parent-portal/documents')
      .set(auth(parentToken))
      .send({
        studentId: child1,
        title: 'Term Report',
        category: 'REPORT_CARD',
        fileKey: presign.body.fileKey,
        fileName: 'report.pdf',
        contentType: 'application/pdf',
        size: 1234,
      })
      .expect(201);
    const docId = confirm.body.id;

    const list = await http()
      .get(`/api/v1/parent-portal/documents?studentId=${child1}`)
      .set(auth(parentToken))
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].downloadUrl).toBeTruthy();

    // Non-linked child → 403.
    await http()
      .post('/api/v1/parent-portal/documents/presign')
      .set(auth(parentToken))
      .send({ studentId: child3, fileName: 'x.pdf', contentType: 'application/pdf' })
      .expect(403);

    await http()
      .delete(`/api/v1/parent-portal/documents/${docId}`)
      .set(auth(parentToken))
      .expect(204);
  });

  // ---- Dashboard -------------------------------------------------------------
  it('returns a child dashboard for a linked child and 403 otherwise', async () => {
    const res = await http()
      .get(`/api/v1/parent/dashboard?studentId=${child2}`)
      .set(auth(parentToken))
      .expect(200);
    expect(res.body.student.id).toBe(child2);
    expect(res.body.attendanceLast30Days).toEqual({ PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 });
    expect(res.body.outstandingBalance).toBe('0.000');

    await http()
      .get(`/api/v1/parent/dashboard?studentId=${child3}`)
      .set(auth(parentToken))
      .expect(403);
  });
});

/**
 * End-to-end tests for the Communication System against a real PostgreSQL: announcement
 * audience fan-out → the notification center, mark-read, device registration, the
 * feature-flagged WhatsApp bridge, and RBAC.
 */
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/services/password.service';
import { RbacService } from '../src/auth/services/rbac.service';
import { withPlatform } from '../src/prisma/tenant.helpers';
import { WhatsAppBridge } from '../src/communication/dispatch/whatsapp.bridge';
import { TenantContextStore } from '../src/prisma/tenant-context';
import { RoleKey } from '@school/domain';

const TENANT = 'eeee5555-eeee-5555-eeee-555555555555';
const PASSWORD = 'Sup3rSecret!';

describe('Communication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bridge: WhatsAppBridge;
  let adminToken: string;
  let parentToken: string;
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
    bridge = moduleRef.get(WhatsAppBridge);
    const passwords = moduleRef.get(PasswordService);
    const rbac = moduleRef.get(RbacService);
    const hash = await passwords.hash(PASSWORD);

    await withPlatform(prisma, async (tx) => {
      await tx.tenant.deleteMany({ where: { id: TENANT } });
      await tx.tenant.create({ data: { id: TENANT, name: 'com', slug: 'com', status: 'ACTIVE' } });
      await rbac.provisionTenantRoles(tx, TENANT);

      const admin = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'admin@com.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT, admin.id, RoleKey.SchoolAdmin);
      const parent = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'parent@com.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT, parent.id, RoleKey.Parent);
      const teacher = await tx.user.create({
        data: {
          tenantId: TENANT,
          email: 'teacher@com.example',
          status: 'ACTIVE',
          passwordHash: hash,
          mustChangePassword: false,
        },
      });
      await rbac.assignRole(tx, TENANT, teacher.id, RoleKey.Teacher);
    });

    adminToken = await login('admin@com.example');
    parentToken = await login('parent@com.example');
    teacherToken = await login('teacher@com.example');
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT } }));
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, tenantSlug: 'com' })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('fans an announcement out to the audience (parents get it, teacher does not)', async () => {
    const res = await http()
      .post('/api/v1/announcements')
      .set(auth(adminToken))
      .send({ title: 'Holiday', body: 'School closed Sunday', audience: 'PARENTS' })
      .expect(201);
    expect(res.body.recipients).toBe(1); // one parent

    const parentInbox = await http()
      .get('/api/v1/notifications/me')
      .set(auth(parentToken))
      .expect(200);
    expect(parentInbox.body).toHaveLength(1);
    expect(parentInbox.body[0].title).toBe('Holiday');

    const teacherInbox = await http()
      .get('/api/v1/notifications/me')
      .set(auth(teacherToken))
      .expect(200);
    expect(teacherInbox.body).toHaveLength(0);
  });

  it('tracks unread count and marks notifications read', async () => {
    const before = await http()
      .get('/api/v1/notifications/me/unread-count')
      .set(auth(parentToken))
      .expect(200);
    expect(before.body.count).toBe(1);

    const inbox = await http().get('/api/v1/notifications/me').set(auth(parentToken)).expect(200);
    await http()
      .post(`/api/v1/notifications/${inbox.body[0].id}/read`)
      .set(auth(parentToken))
      .expect(200);

    const after = await http()
      .get('/api/v1/notifications/me/unread-count')
      .set(auth(parentToken))
      .expect(200);
    expect(after.body.count).toBe(0);
  });

  it('registers a device token', async () => {
    const res = await http()
      .post('/api/v1/notifications/devices')
      .set(auth(parentToken))
      .send({ token: 'fcm-token-abc123', platform: 'ANDROID' })
      .expect(201);
    expect(res.body.token).toBe('fcm-token-abc123');
  });

  it('gates the WhatsApp bridge behind a feature flag (off by default)', async () => {
    const offResult = await TenantContextStore.run({ tenantId: TENANT }, () =>
      bridge.notify({ title: 'x', body: 'y' }),
    );
    expect(offResult).toBe(false); // disabled → no dispatch

    await http()
      .put('/api/v1/feature-flags/whatsapp_bridge')
      .set(auth(adminToken))
      .send({ enabled: true })
      .expect(200);

    const onResult = await TenantContextStore.run({ tenantId: TENANT }, () =>
      bridge.notify({ title: 'x', body: 'y' }),
    );
    expect(onResult).toBe(true); // enabled → dispatched
  });

  it('enforces permissions (Parent cannot publish announcements or manage flags)', async () => {
    await http()
      .post('/api/v1/announcements')
      .set(auth(parentToken))
      .send({ title: 'X', body: 'Y', audience: 'ALL' })
      .expect(403);
    await http()
      .put('/api/v1/feature-flags/whatsapp_bridge')
      .set(auth(parentToken))
      .send({ enabled: false })
      .expect(403);
  });
});

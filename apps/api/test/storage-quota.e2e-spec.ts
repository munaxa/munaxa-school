/**
 * The plan's `storage_gb` limit against a real PostgreSQL (docs/ops/licensing.md, "Storage"): it is
 * held against the ledger of bytes the school stores (`StoredObject`), never a size the client
 * declares. Above all under concurrency — ten simultaneous upload URLs with room for three issue
 * exactly three, because the count and the reservation share one transaction holding the tenant's
 * storage lock. Also: a confirmation counts once however often it is repeated, an upload that never
 * arrived cannot be confirmed, an expired reservation stops holding room, a replaced asset stops
 * counting, and reconciliation makes the ledger agree with the bucket.
 *
 * No bucket is configured here, so an upload's size is the one reserved for it; the bucket's own
 * answer (HEAD) is covered by `storage.service.spec.ts`.
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
import { StorageLedgerRepository } from '../src/common/storage-ledger.repository';
import { withPlatform } from '../src/prisma/tenant.helpers';
import { TenantContextStore } from '../src/prisma/tenant-context';

const TENANT_ID = '55555555-5555-5555-5555-5555555555d2';
const SLUG = 'storage-e2e';
const EMAIL = 'admin@storage-e2e.example';
const PASSWORD = 'Sup3rSecret!';
const MIB = 1024 * 1024;
const GIB = 1024n ** 3n;

describe('Storage limit, metered by stored bytes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let subscriptions: SubscriptionService;
  let ledger: StorageLedgerRepository;
  let token: string;

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const presign = (n: number, size = MIB) =>
    http()
      .post('/api/v1/organization/assets/presign')
      .set(auth())
      .send({ slot: 'banner', fileName: `b${n}.png`, contentType: 'image/png', size });
  const confirm = (fileKey: string, slot = 'banner') =>
    http()
      .post('/api/v1/organization/assets/confirm')
      .set(auth())
      .send({ slot, fileKey, contentType: 'image/png' });

  const rows = () =>
    withPlatform(prisma, (tx) =>
      tx.storedObject.findMany({ where: { tenantId: TENANT_ID }, orderBy: { createdAt: 'asc' } }),
    );
  /** The usage table's storage figure, once the asynchronous usage writer has caught up. */
  async function usageGb(): Promise<number | undefined> {
    let value: number | undefined;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const usage = await withPlatform(prisma, (tx) =>
        tx.subscriptionUsage.findFirst({
          where: { tenantId: TENANT_ID, metric: LimitKey.STORAGE_GB },
        }),
      );
      value = usage === null ? undefined : Number(usage.value);
      if (value !== undefined && value > 0) return value;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return value;
  }
  const byState = async (state: string) => (await rows()).filter((r) => r.state === state);

  /** The school's limit in GB, and a stored object that leaves exactly `freeBytes` of room. */
  async function leaveRoom(limitGb: number, freeBytes: number) {
    await withPlatform(prisma, async (tx) => {
      await tx.storedObject.deleteMany({ where: { tenantId: TENANT_ID } });
      await tx.tenantFeatureOverride.upsert({
        where: { tenantId_key: { tenantId: TENANT_ID, key: LimitKey.STORAGE_GB } },
        create: { tenantId: TENANT_ID, key: LimitKey.STORAGE_GB, limitOverride: limitGb },
        update: { limitOverride: limitGb },
      });
      const filler = BigInt(limitGb) * GIB - BigInt(freeBytes);
      await tx.storedObject.create({
        data: {
          key: `tenants/${TENANT_ID}/filler/existing.bin`,
          tenantId: TENANT_ID,
          state: 'STORED',
          reservedBytes: filler,
          storedBytes: filler,
          expiresAt: new Date(),
        },
      });
    });
    subscriptions.invalidate(TENANT_ID);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);
    subscriptions = moduleRef.get(SubscriptionService);
    ledger = moduleRef.get(StorageLedgerRepository);
    const passwords = moduleRef.get(PasswordService);
    const rbac = moduleRef.get(RbacService);

    await withPlatform(prisma, async (tx) => {
      await tx.tenant.deleteMany({ where: { id: TENANT_ID } });
      await tx.tenant.create({
        data: { id: TENANT_ID, name: 'Storage E2E', slug: SLUG, status: 'ACTIVE' },
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

  it('ten simultaneous upload URLs with room for three issue exactly three', async () => {
    await leaveRoom(1, 3 * MIB);
    const answers = await Promise.all(Array.from({ length: 10 }, (_, n) => presign(n)));
    const statuses = answers.map((a) => a.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(3);
    expect(statuses.filter((s) => s === 403)).toHaveLength(7);
    expect(answers.find((a) => a.status === 403)?.body.message).toMatch(/storage/);
    expect(await byState('RESERVED')).toHaveLength(3);
  });

  it('a reservation holds the declared size, or the ceiling when none is declared', async () => {
    await leaveRoom(1, 4 * MIB);
    // No size declared: the image ceiling (5 MB) is reserved, and it does not fit in 4.
    const undeclared = await http()
      .post('/api/v1/organization/assets/presign')
      .set(auth())
      .send({ slot: 'logo', fileName: 'l.png', contentType: 'image/png' });
    expect(undeclared.status).toBe(403);
    expect((await presign(1, 4 * MIB)).status).toBe(200);
  });

  it('counts a confirmed upload once, however often it is confirmed, and reports usage', async () => {
    await leaveRoom(1, 2 * MIB);
    const { fileKey } = (await presign(1).expect(200)).body as { fileKey: string };
    expect((await confirm(fileKey)).status).toBe(200);
    expect((await confirm(fileKey)).status).toBe(200);

    const stored = (await byState('STORED')).filter((r) => r.key === fileKey);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.storedBytes).toBe(BigInt(MIB));
    expect(await TenantContextStore.run({ tenantId: TENANT_ID }, () => ledger.totalStored())).toBe(
      GIB - BigInt(MIB),
    );

    // The usage table follows the ledger through the StorageChanged event, in whole GB rounded
    // up: just under 1 GB stored reads as 1, never as 0.
    expect(await usageGb()).toBe(1);
  });

  it('refuses to confirm an upload that was never issued, or that belongs to another school', async () => {
    await leaveRoom(1, 10 * MIB);
    expect((await confirm(`tenants/${TENANT_ID}/organization/never-issued.png`)).status).toBe(400);
    expect(
      (await confirm('tenants/00000000-0000-0000-0000-000000000000/organization/x.png')).status,
    ).toBe(403);
    expect(await byState('STORED')).toHaveLength(1); // only the filler
  });

  it('stops counting an expired reservation once the next upload settles it', async () => {
    await leaveRoom(1, 2 * MIB);
    await presign(1, 2 * MIB).expect(200);
    expect((await presign(2, MIB)).status).toBe(403); // the room is reserved
    await withPlatform(prisma, (tx) =>
      tx.storedObject.updateMany({
        where: { tenantId: TENANT_ID, state: 'RESERVED' },
        data: { expiresAt: new Date(Date.now() - 1000) },
      }),
    );
    // The URL expired and nothing arrived (there is no bucket here): the room is free again.
    expect((await presign(3, MIB)).status).toBe(200);
    expect((await byState('DELETED')).map((r) => r.reservedBytes)).toEqual([BigInt(2 * MIB)]);
  });

  it('releases the bytes of an asset that is replaced, or removed', async () => {
    await leaveRoom(1, 10 * MIB);
    const first = (await presign(1).expect(200)).body as { fileKey: string };
    await confirm(first.fileKey, 'stamp').expect(200);
    const second = (await presign(2).expect(200)).body as { fileKey: string };
    await confirm(second.fileKey, 'stamp').expect(200);

    const states = new Map((await rows()).map((r) => [r.key, r.state]));
    expect(states.get(first.fileKey)).toBe('DELETED');
    expect(states.get(second.fileKey)).toBe('STORED');

    await http().delete('/api/v1/organization/assets/stamp').set(auth()).expect(200);
    expect(new Map((await rows()).map((r) => [r.key, r.state])).get(second.fileKey)).toBe(
      'DELETED',
    );
  });

  it('reconciliation adopts what the bucket holds and forgets what it does not', async () => {
    await leaveRoom(1, 10 * MIB);
    const unconfirmed = `tenants/${TENANT_ID}/homework/h/uploaded-never-confirmed.pdf`;
    const listed = new Map([[unconfirmed, 3_000n]]); // the filler is gone from the bucket
    const result = await ledger.reconcile(TENANT_ID, listed);
    expect(result).toMatchObject({ adopted: 1, vanished: 1, total: 3_000n });
    const states = new Map((await rows()).map((r) => [r.key, r.state]));
    expect(states.get(unconfirmed)).toBe('STORED');
    expect(states.get(`tenants/${TENANT_ID}/filler/existing.bin`)).toBe('DELETED');
  });

  it('refuses at the database a ledger row outside its school', async () => {
    await expect(
      withPlatform(prisma, (tx) =>
        tx.storedObject.create({
          data: {
            key: 'tenants/00000000-0000-0000-0000-000000000000/x',
            tenantId: TENANT_ID,
            state: 'STORED',
            reservedBytes: 1n,
            storedBytes: 1n,
            expiresAt: new Date(),
          },
        }),
      ),
    ).rejects.toThrow(/StoredObject_key_in_tenant/);
  });
});

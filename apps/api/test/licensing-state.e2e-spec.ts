/**
 * `LicensingState` against a real PostgreSQL as the restricted app role, so row-level security is
 * what is being tested: a school's verified entitlements are kept across restarts, the observed
 * instant only moves forward, and one school can neither read nor overwrite another's.
 */
import { Test } from '@nestjs/testing';
import type { EntitlementSnapshot } from '@munaxa/licensing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { withPlatform, withTenant } from '../src/prisma/tenant.helpers';
import { LicensingStateStore } from '../src/subscription/licensing-state.store';

const SCHOOL_A = '55555555-5555-5555-5555-5555555555b1';
const SCHOOL_B = '55555555-5555-5555-5555-5555555555b2';

const snapshotFor = (tenantId: string): EntitlementSnapshot => ({
  schemaVersion: 1,
  customerId: 'cus_1',
  tenantId,
  product: 'school',
  deployment: 'SAAS',
  subscriptionId: 'sub_1',
  plan: { code: 'professional', version: 1 },
  status: 'ACTIVE',
  trialEndsAt: null,
  expiresAt: null,
  graceUntil: null,
  features: ['advanced_reports'],
  limits: { students: 1500 },
  resolvedAt: '2026-10-27T09:00:00.000Z',
});

describe('LicensingState (e2e)', () => {
  let prisma: PrismaService;
  let store: LicensingStateStore;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    close = () => app.close();
    prisma = moduleRef.get(PrismaService);
    store = moduleRef.get(LicensingStateStore);
    await withPlatform(prisma, async (tx) => {
      await tx.tenant.deleteMany({ where: { id: { in: [SCHOOL_A, SCHOOL_B] } } });
      for (const [id, slug] of [
        [SCHOOL_A, 'licensing-state-a'],
        [SCHOOL_B, 'licensing-state-b'],
      ] as const) {
        await tx.tenant.create({ data: { id, name: slug, slug, status: 'ACTIVE' } });
      }
    });
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) =>
      tx.tenant.deleteMany({ where: { id: { in: [SCHOOL_A, SCHOOL_B] } } }),
    );
    await close();
  });

  it('keeps the last snapshot, and moves the observed instant forward only', async () => {
    await store.write(SCHOOL_A, {
      snapshot: snapshotFor(SCHOOL_A),
      source: 'CONTROL_PLANE',
      observedAt: new Date('2026-10-27T10:00:00Z'),
    });
    await store.write(SCHOOL_A, {
      snapshot: null,
      source: 'CONTROL_PLANE',
      observedAt: new Date('2026-10-01T00:00:00Z'),
    });
    const stored = await store.read(SCHOOL_A);
    expect(stored?.snapshot).toBeNull();
    expect(stored?.lastObservedAt.toISOString()).toBe('2026-10-27T10:00:00.000Z');
  });

  it("one school can neither read nor write another's state", async () => {
    await store.write(SCHOOL_B, {
      snapshot: snapshotFor(SCHOOL_B),
      source: 'CONTROL_PLANE',
      observedAt: new Date('2026-10-27T10:00:00Z'),
    });
    const seen = await withTenant(prisma, SCHOOL_A, (tx) =>
      tx.licensingState.findMany({ where: { tenantId: SCHOOL_B } }),
    );
    expect(seen).toEqual([]);
    await expect(
      withTenant(
        prisma,
        SCHOOL_A,
        (tx) =>
          tx.$executeRaw`UPDATE "LicensingState" SET "snapshot" = NULL WHERE "tenantId" = ${SCHOOL_B}::uuid`,
      ),
    ).resolves.toBe(0);
    expect((await store.read(SCHOOL_B))?.snapshot?.tenantId).toBe(SCHOOL_B);
  });
});

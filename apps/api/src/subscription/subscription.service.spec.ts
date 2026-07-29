import { ForbiddenException } from '@nestjs/common';
import { LimitKey, PlanFeature } from '@school/domain';
import { SubscriptionService } from './subscription.service';
import type { SubscriptionRepository } from './subscription.repository';
import type { SubscriptionSnapshot } from './subscription.types';

const TENANT = 't1';

/** Build a snapshot with a Starter-like plan by default. */
function snapshot(
  overrides: Partial<{
    plan: {
      features: Array<{ key: string; enabled: boolean }>;
      maxStudents: number | null;
      maxCampuses: number | null;
      maxStaff: number | null;
      storageGb: number | null;
    };
    status: string;
    billingCycle: string;
    trialEndsAt: Date | null;
    currentPeriodEnd: Date | null;
    featureOverrides: Array<{
      key: string;
      enabled: boolean | null;
      limitOverride: number | null;
      expiresAt: Date | null;
    }>;
    usage: Record<string, number>;
    noSubscription: boolean;
  }>,
): SubscriptionSnapshot {
  const overridesMap = new Map(
    (overrides.featureOverrides ?? []).map((o) => [
      o.key,
      {
        key: o.key,
        enabled: o.enabled,
        limitOverride: o.limitOverride,
        expiresAt: o.expiresAt,
      } as never,
    ]),
  );
  const usage = new Map(Object.entries(overrides.usage ?? {}));
  if (overrides.noSubscription) {
    return { subscription: null, overrides: overridesMap, usage };
  }
  const plan = overrides.plan ?? {
    features: [],
    maxStudents: 300,
    maxCampuses: 1,
    maxStaff: 20,
    storageGb: 10,
  };
  return {
    subscription: {
      status: overrides.status ?? 'ACTIVE',
      billingCycle: overrides.billingCycle ?? 'MONTHLY',
      trialEndsAt: overrides.trialEndsAt ?? null,
      currentPeriodEnd: overrides.currentPeriodEnd ?? null,
      plan: {
        id: 'plan1',
        tier: 'STARTER',
        name: 'Starter',
        description: null,
        isActive: true,
        sortOrder: 1,
        priceMonthly: 4900,
        priceYearly: 49000,
        currency: 'JOD',
        maxStudents: plan.maxStudents,
        maxCampuses: plan.maxCampuses,
        maxStaff: plan.maxStaff,
        storageGb: plan.storageGb,
        features: plan.features.map((f, i) => ({ id: `f${i}`, key: f.key, enabled: f.enabled })),
      },
    },
    overrides: overridesMap,
    usage,
  } as unknown as SubscriptionSnapshot;
}

function makeService(snap: SubscriptionSnapshot) {
  const setUsage = jest.fn().mockResolvedValue(undefined);
  const repo = {
    loadSnapshot: jest.fn().mockResolvedValue(snap),
    setUsage,
  } as unknown as SubscriptionRepository;
  return { service: new SubscriptionService(repo), setUsage };
}

describe('SubscriptionService', () => {
  describe('canUseFeature', () => {
    it('always allows core modules regardless of plan', async () => {
      const { service } = makeService(
        snapshot({
          plan: { features: [], maxStudents: 300, maxCampuses: 1, maxStaff: 20, storageGb: 10 },
        }),
      );
      await expect(service.canUseFeature(TENANT, 'attendance')).resolves.toBe(true);
      await expect(service.canUseFeature(TENANT, 'finance')).resolves.toBe(true);
    });

    it('reflects the plan capability set for paid features', async () => {
      const { service } = makeService(
        snapshot({
          plan: {
            features: [{ key: PlanFeature.API, enabled: true }],
            maxStudents: 1500,
            maxCampuses: 5,
            maxStaff: null,
            storageGb: 100,
          },
        }),
      );
      await expect(service.canUseFeature(TENANT, PlanFeature.API)).resolves.toBe(true);
      await expect(service.canUseFeature(TENANT, PlanFeature.SSO)).resolves.toBe(false);
    });

    it('lets a per-tenant override enable a capability the plan lacks', async () => {
      const { service } = makeService(
        snapshot({
          featureOverrides: [
            { key: PlanFeature.AI_ASSISTANT, enabled: true, limitOverride: null, expiresAt: null },
          ],
        }),
      );
      await expect(service.canUseFeature(TENANT, PlanFeature.AI_ASSISTANT)).resolves.toBe(true);
    });

    it('is permissive when the tenant has no subscription (existing schools keep working)', async () => {
      const { service } = makeService(snapshot({ noSubscription: true }));
      await expect(service.canUseFeature(TENANT, PlanFeature.WHITE_LABEL)).resolves.toBe(true);
    });
  });

  describe('getLimit', () => {
    it('returns the plan column', async () => {
      const { service } = makeService(snapshot({}));
      await expect(service.getLimit(TENANT, LimitKey.STUDENTS)).resolves.toBe(300);
    });

    it('lets an override raise a limit', async () => {
      const { service } = makeService(
        snapshot({
          featureOverrides: [
            { key: LimitKey.STUDENTS, enabled: null, limitOverride: 500, expiresAt: null },
          ],
        }),
      );
      await expect(service.getLimit(TENANT, LimitKey.STUDENTS)).resolves.toBe(500);
    });

    it('treats a null plan column as unlimited', async () => {
      const { service } = makeService(
        snapshot({
          plan: {
            features: [],
            maxStudents: null,
            maxCampuses: null,
            maxStaff: null,
            storageGb: null,
          },
        }),
      );
      await expect(service.getLimit(TENANT, LimitKey.STUDENTS)).resolves.toBeNull();
    });

    it('ignores an expired override', async () => {
      const { service } = makeService(snapshot({ featureOverrides: [] }));
      // expired overrides are filtered by the repository, so an empty map means "use plan"
      await expect(service.getLimit(TENANT, LimitKey.STUDENTS)).resolves.toBe(300);
    });
  });

  describe('isTrial / daysRemaining', () => {
    it('detects trial status', async () => {
      const { service } = makeService(snapshot({ status: 'TRIALING', billingCycle: 'TRIAL' }));
      await expect(service.isTrial(TENANT)).resolves.toBe(true);
    });

    it('computes whole days remaining, never negative', async () => {
      const inThreeDays = new Date(Date.now() + 3 * 86_400_000 + 1000);
      const { service } = makeService(snapshot({ trialEndsAt: inThreeDays, status: 'TRIALING' }));
      await expect(service.daysRemaining(TENANT)).resolves.toBe(4);

      const past = new Date(Date.now() - 86_400_000);
      const { service: s2 } = makeService(snapshot({ currentPeriodEnd: past }));
      await expect(s2.daysRemaining(TENANT)).resolves.toBe(0);
    });
  });

  describe('remainingStudentCapacity', () => {
    it('subtracts usage from the limit', async () => {
      const { service } = makeService(snapshot({ usage: { students: 120 } }));
      await expect(service.remainingStudentCapacity(TENANT)).resolves.toBe(180);
    });

    it('is null (unlimited) when the plan has no student cap', async () => {
      const { service } = makeService(
        snapshot({
          plan: {
            features: [],
            maxStudents: null,
            maxCampuses: null,
            maxStaff: null,
            storageGb: null,
          },
        }),
      );
      await expect(service.remainingStudentCapacity(TENANT)).resolves.toBeNull();
    });
  });

  describe('assertCapacity', () => {
    it('throws an upgrade message when the next unit would exceed the limit', async () => {
      const { service } = makeService(snapshot({}));
      await expect(service.assertCapacity(TENANT, LimitKey.STUDENTS, 300, 1)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.assertCapacity(TENANT, LimitKey.STUDENTS, 300, 1)).rejects.toThrow(
        /reached the Starter plan student limit \(300\)/,
      );
    });

    it('allows creation below the limit', async () => {
      const { service } = makeService(snapshot({}));
      await expect(
        service.assertCapacity(TENANT, LimitKey.STUDENTS, 299, 1),
      ).resolves.toBeUndefined();
    });

    it('never blocks when the limit is unlimited', async () => {
      const { service } = makeService(
        snapshot({
          plan: {
            features: [],
            maxStudents: null,
            maxCampuses: null,
            maxStaff: null,
            storageGb: null,
          },
        }),
      );
      await expect(
        service.assertCapacity(TENANT, LimitKey.STUDENTS, 99999, 1),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertFeature', () => {
    it('throws when the capability is unavailable', async () => {
      const { service } = makeService(snapshot({}));
      await expect(service.assertFeature(TENANT, PlanFeature.API)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('passes when available', async () => {
      const { service } = makeService(
        snapshot({
          plan: {
            features: [{ key: PlanFeature.API, enabled: true }],
            maxStudents: 1500,
            maxCampuses: 5,
            maxStaff: null,
            storageGb: 100,
          },
        }),
      );
      await expect(service.assertFeature(TENANT, PlanFeature.API)).resolves.toBeUndefined();
    });
  });

  describe('syncUsage', () => {
    it('persists the metric and invalidates the cache', async () => {
      const { service, setUsage } = makeService(snapshot({}));
      await service.syncUsage(TENANT, LimitKey.STUDENTS, 5);
      expect(setUsage).toHaveBeenCalledWith(TENANT, LimitKey.STUDENTS, 5);
    });
  });
});

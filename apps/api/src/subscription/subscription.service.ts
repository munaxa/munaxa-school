import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { canMutate, isCoreModule, LimitKey, PlanFeature } from '@school/domain';
import type { SubscriptionPlan, SubscriptionFeature } from '@prisma/client';
import { SubscriptionRepository } from './subscription.repository';
import type {
  PlanView,
  SubscriptionSnapshot,
  SubscriptionSummary,
  UsageLimit,
} from './subscription.types';

interface CacheEntry {
  snapshot: SubscriptionSnapshot;
  expiresAt: number;
}

/** Maps a limit key to the plan column that holds it. */
const LIMIT_COLUMN: Record<
  string,
  keyof Pick<SubscriptionPlan, 'maxStudents' | 'maxCampuses' | 'maxStaff' | 'storageGb'>
> = {
  [LimitKey.STUDENTS]: 'maxStudents',
  [LimitKey.CAMPUSES]: 'maxCampuses',
  [LimitKey.STAFF]: 'maxStaff',
  [LimitKey.STORAGE_GB]: 'storageGb',
};

/**
 * The central subscription resolver. This is the ONLY place feature availability and
 * quota limits are decided — no module should hard-code a limit or a plan check.
 *
 * Resolution order for a capability/limit:
 *   1. CORE modules are always available (never gated).
 *   2. A non-expired per-tenant override wins (enable/disable a capability, raise/lower a limit).
 *   3. Otherwise the tenant's plan decides.
 *   4. If the tenant has NO subscription (e.g. schools that predate billing), the resolver is
 *      permissive — unlimited limits, capabilities allowed — so existing schools keep working
 *      unchanged. Enforcement only bites once a school is placed on a plan.
 *
 * Snapshots are cached in-process for a short TTL (the same pattern as {@link FeatureGate}),
 * since these checks run on hot paths but subscriptions change rarely.
 */
@Injectable()
export class SubscriptionService {
  static readonly TTL_MS = 30_000;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly repo: SubscriptionRepository) {}

  private async snapshot(tenantId: string): Promise<SubscriptionSnapshot> {
    const now = Date.now();
    const hit = this.cache.get(tenantId);
    if (hit && hit.expiresAt > now) return hit.snapshot;
    const snapshot = await this.repo.loadSnapshot(tenantId);
    this.cache.set(tenantId, { snapshot, expiresAt: now + SubscriptionService.TTL_MS });
    return snapshot;
  }

  /** Drop the cached snapshot for a tenant (call after a plan/override change). */
  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  /** The tenant's current plan, or `null` if it has no subscription. */
  async currentPlan(tenantId: string): Promise<PlanView | null> {
    const snap = await this.snapshot(tenantId);
    return snap.subscription ? toPlanView(snap.subscription.plan) : null;
  }

  /**
   * Whether a feature/capability is available to the tenant. Core modules always return `true`.
   * A per-tenant override takes precedence over the plan.
   */
  async canUseFeature(tenantId: string, key: string): Promise<boolean> {
    if (isCoreModule(key)) return true;
    const snap = await this.snapshot(tenantId);

    const override = snap.overrides.get(key);
    if (override && override.enabled !== null) return override.enabled;

    if (!snap.subscription) return true; // permissive when un-subscribed (see class doc)
    return snap.subscription.plan.features.some((f) => f.key === key && f.enabled);
  }

  /**
   * The effective numeric limit for a dimension. `null` = UNLIMITED. A per-tenant
   * `limitOverride` wins over the plan column.
   */
  async getLimit(tenantId: string, key: string): Promise<number | null> {
    const snap = await this.snapshot(tenantId);

    const override = snap.overrides.get(key);
    if (override && override.limitOverride !== null) return override.limitOverride;

    if (!snap.subscription) return null; // unlimited when un-subscribed
    const column = LIMIT_COLUMN[key];
    return column ? snap.subscription.plan[column] : null;
  }

  /** The tenant's subscription status, or `null` when it has no subscription. */
  async status(tenantId: string): Promise<string | null> {
    const snap = await this.snapshot(tenantId);
    return snap.subscription?.status ?? null;
  }

  /**
   * Whether the tenant may perform create/update/delete right now. False in READ_ONLY and any
   * suspended/terminal state; true when ACTIVE/TRIALING/PAST_DUE/GRACE_PERIOD or un-subscribed.
   * Delegates the state→policy decision to the shared domain helper (single source of truth).
   */
  async canMutate(tenantId: string): Promise<boolean> {
    return canMutate(await this.status(tenantId));
  }

  /** Whether the tenant is currently on a trial. */
  async isTrial(tenantId: string): Promise<boolean> {
    const snap = await this.snapshot(tenantId);
    const sub = snap.subscription;
    if (!sub) return false;
    return sub.status === 'TRIALING' || sub.billingCycle === 'TRIAL';
  }

  /**
   * Whole days remaining until the trial or the current billing period ends. `null` when
   * there is no end date (e.g. no subscription, or an unbounded arrangement). Never negative.
   */
  async daysRemaining(tenantId: string): Promise<number | null> {
    const snap = await this.snapshot(tenantId);
    const sub = snap.subscription;
    if (!sub) return null;
    const end = sub.trialEndsAt ?? sub.currentPeriodEnd;
    if (!end) return null;
    const ms = end.getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86_400_000));
  }

  /** Current usage for a metric (0 if untracked). */
  async currentUsage(tenantId: string, metric: string): Promise<number> {
    const snap = await this.snapshot(tenantId);
    return snap.usage.get(metric) ?? 0;
  }

  /**
   * Students the tenant may still enroll before hitting its limit. `null` = unlimited.
   * Never negative (clamped at 0 when already over).
   */
  async remainingStudentCapacity(tenantId: string): Promise<number | null> {
    const limit = await this.getLimit(tenantId, LimitKey.STUDENTS);
    if (limit === null) return null;
    const used = await this.currentUsage(tenantId, LimitKey.STUDENTS);
    return Math.max(0, limit - used);
  }

  /** Remaining capacity for any metered dimension. `null` = unlimited. */
  async remainingCapacity(tenantId: string, key: string): Promise<number | null> {
    const limit = await this.getLimit(tenantId, key);
    if (limit === null) return null;
    const used = await this.currentUsage(tenantId, key);
    return Math.max(0, limit - used);
  }

  // --- Enforcement helpers ---------------------------------------------------

  /**
   * Throw a 403 with an upgrade message if adding `additional` units to `metric` would
   * exceed the plan limit. Core capacity is never blocked here — only metered dimensions.
   */
  async assertWithinLimit(tenantId: string, key: string, additional = 1): Promise<void> {
    const limit = await this.getLimit(tenantId, key);
    if (limit === null) return; // unlimited
    const used = await this.currentUsage(tenantId, key);
    if (used + additional > limit) {
      const plan = await this.currentPlan(tenantId);
      throw new ForbiddenException(upgradeMessage(key, limit, plan?.name ?? 'your current'));
    }
  }

  /**
   * Throw a 403 with an upgrade message if `currentCount + additional` would exceed the plan
   * limit for `key`. Callers pass the authoritative live count (e.g. actual student rows) so the
   * check never trusts a stale usage counter. Core capacity is unlimited when the limit is null.
   */
  async assertCapacity(
    tenantId: string,
    key: string,
    currentCount: number,
    additional = 1,
  ): Promise<void> {
    const limit = await this.getLimit(tenantId, key);
    if (limit !== null && currentCount + additional > limit) {
      const plan = await this.currentPlan(tenantId);
      throw new ForbiddenException(upgradeMessage(key, limit, plan?.name ?? 'your current'));
    }
  }

  /** Persist the current usage figure for a metric so the console/summary reflect reality. */
  async syncUsage(tenantId: string, metric: string, value: number): Promise<void> {
    await this.repo.setUsage(tenantId, metric, value);
    this.invalidate(tenantId);
  }

  /** Throw a 403 with an upgrade message if the capability is not available. */
  async assertFeature(tenantId: string, key: string): Promise<void> {
    if (await this.canUseFeature(tenantId, key)) return;
    const plan = await this.currentPlan(tenantId);
    throw new ForbiddenException(
      `${featureLabel(key)} is not included in ${plan?.name ?? 'your current'} plan. Upgrade to unlock it.`,
    );
  }

  // --- Composed views --------------------------------------------------------

  /** The full summary shown under Settings → Subscription. */
  async summary(tenantId: string): Promise<SubscriptionSummary> {
    const snap = await this.snapshot(tenantId);
    const sub = snap.subscription;
    const plan = sub ? toPlanView(sub.plan) : null;

    const usage: UsageLimit[] = await Promise.all(
      Object.values(LimitKey).map(async (key) => {
        const limit = await this.getLimit(tenantId, key);
        const used = snap.usage.get(key) ?? 0;
        return {
          key,
          used,
          limit,
          remaining: limit === null ? null : Math.max(0, limit - used),
          exceeded: limit !== null && used > limit,
        };
      }),
    );

    const features: Record<string, boolean> = {};
    for (const key of Object.values(PlanFeature)) {
      features[key] = await this.canUseFeature(tenantId, key);
    }

    return {
      status: sub?.status ?? 'NONE',
      billingCycle: sub?.billingCycle ?? null,
      plan,
      isTrial: await this.isTrial(tenantId),
      trialEndsAt: sub?.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
      daysRemaining: await this.daysRemaining(tenantId),
      usage,
      features,
      overrides: [...snap.overrides.values()].map((o) => ({
        key: o.key,
        enabled: o.enabled,
        limitOverride: o.limitOverride,
        expiresAt: o.expiresAt?.toISOString() ?? null,
      })),
    };
  }

  // --- School-facing actions -------------------------------------------------

  /** Active plans a school can choose from when requesting an upgrade. */
  async listPlans(tenantId: string): Promise<PlanView[]> {
    const plans = await this.repo.listActivePlans(tenantId);
    return plans.map(toPlanView);
  }

  /** The tenant's own upgrade requests (newest first). */
  listUpgradeRequests(tenantId: string) {
    return this.repo.listUpgradeRequests(tenantId);
  }

  /**
   * Create an upgrade request. Validates the target plan is real, active and different from the
   * current plan, and rejects duplicate pending requests. Does NOT change the subscription —
   * the Platform Console reviews and applies it.
   */
  async requestUpgrade(
    tenantId: string,
    data: { requestedPlanId: string; requestedCycle?: string | null; note?: string | null },
  ) {
    const plan = await this.repo.findPlan(tenantId, data.requestedPlanId);
    if (!plan || !plan.isActive) throw new NotFoundException('Requested plan not found');

    const current = await this.currentPlan(tenantId);
    if (current && current.id === plan.id) {
      throw new BadRequestException('You are already on this plan');
    }
    if (await this.repo.hasPendingRequest(tenantId, plan.id)) {
      throw new ConflictException('An upgrade request for this plan is already pending review');
    }
    return this.repo.createUpgradeRequest(tenantId, data);
  }
}

export function toPlanView(plan: SubscriptionPlan & { features: SubscriptionFeature[] }): PlanView {
  return {
    id: plan.id,
    tier: plan.tier,
    name: plan.name,
    description: plan.description,
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
    currency: plan.currency,
    limits: {
      maxStudents: plan.maxStudents,
      maxCampuses: plan.maxCampuses,
      maxStaff: plan.maxStaff,
      storageGb: plan.storageGb,
    },
    features: plan.features.filter((f) => f.enabled).map((f) => f.key),
  };
}

function featureLabel(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Build the user-facing "you've hit the limit — upgrade" message. */
function upgradeMessage(key: string, limit: number, planName: string): string {
  const label = LIMIT_LABEL[key] ?? key;
  const next = key === LimitKey.STUDENTS || key === LimitKey.CAMPUSES ? 'Professional' : 'a higher';
  return `You have reached the ${planName} plan ${label} limit (${limit}). Upgrade to ${next} to add more.`;
}

const LIMIT_LABEL: Record<string, string> = {
  [LimitKey.STUDENTS]: 'student',
  [LimitKey.CAMPUSES]: 'campus',
  [LimitKey.STAFF]: 'staff',
  [LimitKey.STORAGE_GB]: 'storage (GB)',
};

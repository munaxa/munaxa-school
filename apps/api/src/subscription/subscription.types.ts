import type {
  BillingCycle,
  PlanTier,
  SubscriptionStatus,
  SubscriptionPlan,
  SubscriptionFeature,
  TenantSubscription,
  TenantFeatureOverride,
} from '@prisma/client';

/** A resolved, in-memory snapshot of everything needed to answer feature/limit questions. */
export interface SubscriptionSnapshot {
  subscription:
    | (TenantSubscription & { plan: SubscriptionPlan & { features: SubscriptionFeature[] } })
    | null;
  /** Non-expired per-tenant overrides, keyed by feature/limit key. */
  overrides: Map<string, TenantFeatureOverride>;
  /** Current usage counters, keyed by metric. */
  usage: Map<string, number>;
}

/** The public plan shape returned to schools (upgrade options) and the console. */
export interface PlanView {
  id: string;
  tier: PlanTier;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  priceMonthly: number | null;
  priceYearly: number | null;
  currency: string;
  limits: {
    maxStudents: number | null;
    maxCampuses: number | null;
    maxStaff: number | null;
    storageGb: number | null;
  };
  features: string[];
}

/** A limit dimension + how much of it is used. `limit: null` means unlimited. */
export interface UsageLimit {
  key: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  exceeded: boolean;
}

/** The full subscription summary a school sees under Settings → Subscription. */
export interface SubscriptionSummary {
  status: SubscriptionStatus | 'NONE';
  billingCycle: BillingCycle | null;
  plan: PlanView | null;
  isTrial: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  daysRemaining: number | null;
  usage: UsageLimit[];
  features: Record<string, boolean>;
  overrides: Array<{
    key: string;
    enabled: boolean | null;
    limitOverride: number | null;
    expiresAt: string | null;
  }>;
}

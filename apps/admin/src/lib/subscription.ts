'use client';

import { authFetch } from './auth';

export type PlanTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type BillingCycle = 'MONTHLY' | 'YEARLY' | 'TRIAL';
export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'NONE';

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

export interface UsageLimit {
  key: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  exceeded: boolean;
}

export interface SubscriptionSummary {
  status: SubscriptionStatus;
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

export interface UpgradeRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestedPlan: { name: string; tier: PlanTier } | null;
  fromPlan: { name: string } | null;
  note: string | null;
  createdAt: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

const base = '/subscription';

export const subscriptionApi = {
  summary: () => authFetch(base).then((r) => json<SubscriptionSummary>(r)),
  plans: () => authFetch(`${base}/plans`).then((r) => json<PlanView[]>(r)),
  upgradeRequests: () =>
    authFetch(`${base}/upgrade-requests`).then((r) => json<UpgradeRequest[]>(r)),
  requestUpgrade: (data: {
    requestedPlanId: string;
    requestedCycle?: BillingCycle;
    note?: string;
  }) =>
    authFetch(`${base}/upgrade-requests`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<UpgradeRequest>(r)),
};

/** Format minor currency units (e.g. fils) as a readable amount. */
export function formatPrice(minor: number | null, currency: string): string {
  if (minor === null) return 'Contact sales';
  return `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })} ${currency}`;
}

/** Human label for a limit value (null = unlimited). */
export function formatLimit(limit: number | null): string {
  return limit === null ? 'Unlimited' : limit.toLocaleString();
}

'use client';

import { authFetch } from './auth';
import type { BillingCycle, PlanTier, PlanView, SubscriptionStatus } from './subscription';

export interface DashboardMetrics {
  schools: number;
  subscriptions: number;
  pendingUpgradeRequests: number;
  activeTrials: number;
  trialSchools: number;
  trialConversionRate: number | null;
  renewalsThisMonth: number;
  churnedThisMonth: number;
  failedPayments: number;
  schoolsApproachingLimits: number;
  featureAdoption: { jofotara: number; ai: number };
  storageUsageGb: number;
  apiTraffic: number;
  subscriptionsByStatus: Record<string, number>;
  subscriptionsByTier: Record<string, number>;
  revenue: RevenueView;
}

export interface TimelineItem {
  auditId: string;
  at: string;
  action: string;
  title: string;
  entityType: string;
  entityId: string | null;
  actorUserId: string | null;
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  billingEmail: string | null;
  countryCode: string | null;
  consolidatedBilling: boolean;
  isArchived: boolean;
  schools: number;
  createdAt: string;
}

export interface OrganizationDetail extends Omit<OrganizationRow, 'schools'> {
  schools: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    plan: string | null;
    subscriptionStatus: string;
    students: number;
    campuses: number;
  }>;
  billingSummary: { estimatedMrr: number; currency: string; schoolCount: number };
  usageSummary: Record<string, number>;
}

export interface PlanVersion {
  id: string;
  planId: string;
  version: number;
  isCurrent: boolean;
  limits: Record<string, number | null>;
  featureCodes: string[];
  pricing: Record<string, number | null> | null;
  notes: string | null;
  createdAt: string;
}

export interface WebhookEndpoint {
  id: string;
  tenantId: string | null;
  url: string;
  description: string | null;
  eventTypes: string[];
  secret: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  eventType: string;
  status: string;
  attempts: number;
  responseStatus: number | null;
  lastError: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export interface Invoice {
  id: string;
  number: string;
  status: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  dueDate: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  lines: Array<{
    id: string;
    description: string;
    quantity: number;
    unitAmount: number;
    amount: number;
  }>;
}

export interface Payment {
  id: string;
  invoiceId: string | null;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  externalRef: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface RevenueView {
  mrr: number;
  arr: number;
  currency: string;
  perTier: Record<string, number>;
}

export interface SchoolRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: { tier: PlanTier; name: string } | null;
  subscriptionStatus: SubscriptionStatus;
  billingCycle: BillingCycle | null;
  renewal: string | null;
  trialEndsAt: string | null;
  students: number;
  campuses: number;
  users: number;
  storageGb: number;
  createdAt: string;
}

export interface SchoolDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  counts: { students: number; campuses: number; users: number };
  subscription: {
    status: SubscriptionStatus;
    billingCycle: BillingCycle;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    plan: PlanView;
    coupon: string | null;
  } | null;
  trial: {
    planId: string;
    planName: string;
    endsAt: string;
    convertedAt: string | null;
    expiredAt: string | null;
  } | null;
  billingProfile: Record<string, unknown> | null;
  usage: Array<{ metric: string; value: number }>;
  overrides: Array<{
    key: string;
    enabled: boolean | null;
    limitOverride: number | null;
    reason: string | null;
    expiresAt: string | null;
  }>;
  planChanges: Array<{
    from: string | null;
    to: string;
    toStatus: string | null;
    reason: string | null;
    createdAt: string;
  }>;
  upgradeRequests: Array<{
    id: string;
    status: string;
    requestedPlan: string;
    fromPlan: string | null;
    note: string | null;
    createdAt: string;
  }>;
}

export interface SubscriptionRow {
  id: string;
  tenantId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodEnd: string | null;
  plan: { name: string; tier: PlanTier };
  tenant: { name: string; slug: string; status: string };
}

export interface PlatformUpgradeRequest {
  id: string;
  tenantId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  note: string | null;
  createdAt: string;
  requestedPlan: { name: string; tier: PlanTier };
  fromPlan: { name: string } | null;
  tenant: { name: string; slug: string };
}

export interface AuditRow {
  id: string;
  tenantId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
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

const base = '/platform/console';

export const platformConsoleApi = {
  dashboard: () => authFetch(`${base}/dashboard`).then((r) => json<DashboardMetrics>(r)),
  revenue: () => authFetch(`${base}/revenue`).then((r) => json<RevenueView>(r)),
  systemHealth: () =>
    authFetch(`${base}/system-health`).then((r) =>
      json<{ status: string; uptimeSeconds: number; timestamp: string; node: string }>(r),
    ),
  audit: (query: { tenantId?: string; action?: string; take?: number } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== undefined) as [string, string][],
    ).toString();
    return authFetch(`${base}/audit${qs ? `?${qs}` : ''}`).then((r) => json<AuditRow[]>(r));
  },

  plans: () => authFetch(`${base}/plans`).then((r) => json<PlanView[]>(r)),

  schools: () => authFetch(`${base}/schools`).then((r) => json<SchoolRow[]>(r)),
  school: (tenantId: string) =>
    authFetch(`${base}/schools/${tenantId}`).then((r) => json<SchoolDetail>(r)),

  subscriptions: () => authFetch(`${base}/subscriptions`).then((r) => json<SubscriptionRow[]>(r)),

  changeSubscription: (
    tenantId: string,
    data: {
      planId: string;
      billingCycle?: BillingCycle;
      status?: SubscriptionStatus;
      reason?: string;
    },
  ) =>
    authFetch(`${base}/schools/${tenantId}/subscription`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json(r)),

  setStatus: (tenantId: string, status: SubscriptionStatus) =>
    authFetch(`${base}/schools/${tenantId}/subscription/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }).then((r) => json(r)),

  upgradeRequests: (status?: string) =>
    authFetch(`${base}/upgrade-requests${status ? `?status=${status}` : ''}`).then((r) =>
      json<PlatformUpgradeRequest[]>(r),
    ),

  decideUpgradeRequest: (id: string, decision: 'APPROVE' | 'REJECT', decisionNote?: string) =>
    authFetch(`${base}/upgrade-requests/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, ...(decisionNote ? { decisionNote } : {}) }),
    }).then((r) => json(r)),

  startTrial: (tenantId: string, planId: string, days?: number) =>
    authFetch(`${base}/schools/${tenantId}/trial`, {
      method: 'POST',
      body: JSON.stringify({ planId, ...(days ? { days } : {}) }),
    }).then((r) => json(r)),

  setOverride: (
    tenantId: string,
    data: {
      key: string;
      enabled?: boolean;
      limitOverride?: number;
      reason?: string;
      expiresAt?: string;
    },
  ) =>
    authFetch(`${base}/schools/${tenantId}/overrides`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json(r)),

  deleteOverride: (tenantId: string, key: string) =>
    authFetch(`${base}/schools/${tenantId}/overrides/${key}`, { method: 'DELETE' }).then((r) =>
      json(r),
    ),

  // --- Timeline ---
  timeline: (tenantId: string) =>
    authFetch(`${base}/schools/${tenantId}/timeline`).then((r) => json<TimelineItem[]>(r)),

  // --- Organizations ---
  organizations: (includeArchived = false) =>
    authFetch(`${base}/organizations${includeArchived ? '?includeArchived=true' : ''}`).then((r) =>
      json<OrganizationRow[]>(r),
    ),
  organization: (id: string) =>
    authFetch(`${base}/organizations/${id}`).then((r) => json<OrganizationDetail>(r)),
  assignableSchools: () =>
    authFetch(`${base}/organizations/assignable-schools`).then((r) =>
      json<Array<{ id: string; name: string; slug: string }>>(r),
    ),
  createOrganization: (data: {
    name: string;
    slug: string;
    billingEmail?: string;
    countryCode?: string;
    consolidatedBilling?: boolean;
  }) =>
    authFetch(`${base}/organizations`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json(r),
    ),
  updateOrganization: (id: string, data: Record<string, unknown>) =>
    authFetch(`${base}/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(
      (r) => json(r),
    ),
  archiveOrganization: (id: string) =>
    authFetch(`${base}/organizations/${id}/archive`, { method: 'POST' }).then((r) => json(r)),
  assignSchool: (id: string, tenantId: string) =>
    authFetch(`${base}/organizations/${id}/schools`, {
      method: 'POST',
      body: JSON.stringify({ tenantId }),
    }).then((r) => json(r)),
  removeSchool: (id: string, tenantId: string) =>
    authFetch(`${base}/organizations/${id}/schools/${tenantId}`, { method: 'DELETE' }).then((r) =>
      json(r),
    ),

  // --- Plan versions ---
  planVersions: (planId: string) =>
    authFetch(`${base}/plans/${planId}/versions`).then((r) => json<PlanVersion[]>(r)),
  createPlanVersion: (planId: string, notes?: string) =>
    authFetch(`${base}/plans/${planId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }).then((r) => json(r)),
  publishPlanVersion: (planId: string, versionId: string) =>
    authFetch(`${base}/plans/${planId}/versions/${versionId}/publish`, { method: 'POST' }).then(
      (r) => json(r),
    ),
  retirePlanVersion: (planId: string, versionId: string) =>
    authFetch(`${base}/plans/${planId}/versions/${versionId}/retire`, { method: 'POST' }).then(
      (r) => json(r),
    ),
  migrationPreview: (planId: string, toVersionId: string) =>
    authFetch(`${base}/plans/${planId}/versions/migration-preview?toVersionId=${toVersionId}`).then(
      (r) =>
        json<{ count: number; schools: Array<{ tenantId: string; name: string; slug: string }> }>(
          r,
        ),
    ),
  migratePlanVersion: (planId: string, toVersionId: string) =>
    authFetch(`${base}/plans/${planId}/versions/migrate`, {
      method: 'POST',
      body: JSON.stringify({ toVersionId }),
    }).then((r) => json<{ migrated: number }>(r)),

  // --- Webhooks ---
  webhooks: () => authFetch(`${base}/webhooks`).then((r) => json<WebhookEndpoint[]>(r)),
  createWebhook: (data: {
    url: string;
    description?: string;
    eventTypes?: string[];
    secret?: string;
    tenantId?: string;
  }) =>
    authFetch(`${base}/webhooks`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json(r),
    ),
  deleteWebhook: (id: string) =>
    authFetch(`${base}/webhooks/${id}`, { method: 'DELETE' }).then((r) => json(r)),
  disableWebhook: (id: string) =>
    authFetch(`${base}/webhooks/${id}/disable`, { method: 'POST' }).then((r) => json(r)),
  enableWebhook: (id: string) =>
    authFetch(`${base}/webhooks/${id}/enable`, { method: 'POST' }).then((r) => json(r)),
  rotateWebhookSecret: (id: string) =>
    authFetch(`${base}/webhooks/${id}/rotate-secret`, { method: 'POST' }).then((r) =>
      json<WebhookEndpoint>(r),
    ),
  webhookDeliveries: (id: string, failed = false) =>
    authFetch(`${base}/webhooks/${id}/deliveries${failed ? '?failed=true' : ''}`).then((r) =>
      json<WebhookDelivery[]>(r),
    ),
  retryDelivery: (deliveryId: string) =>
    authFetch(`${base}/webhooks/deliveries/${deliveryId}/retry`, { method: 'POST' }).then((r) =>
      json(r),
    ),

  // --- Billing ---
  invoices: (tenantId: string) =>
    authFetch(`${base}/schools/${tenantId}/billing/invoices`).then((r) => json<Invoice[]>(r)),
  createInvoice: (tenantId: string, data: Record<string, unknown>) =>
    authFetch(`${base}/schools/${tenantId}/billing/invoices`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json(r)),
  issueInvoice: (tenantId: string, id: string) =>
    authFetch(`${base}/schools/${tenantId}/billing/invoices/${id}/issue`, { method: 'POST' }).then(
      (r) => json(r),
    ),
  payments: (tenantId: string) =>
    authFetch(`${base}/schools/${tenantId}/billing/payments`).then((r) => json<Payment[]>(r)),
  recordPayment: (tenantId: string, data: Record<string, unknown>) =>
    authFetch(`${base}/schools/${tenantId}/billing/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json(r)),
  refund: (tenantId: string, data: { paymentId: string; amount: number; reason?: string }) =>
    authFetch(`${base}/schools/${tenantId}/billing/refunds`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json(r)),

  // --- Subscription state actions ---
  extendTrial: (tenantId: string, days: number) =>
    authFetch(`${base}/schools/${tenantId}/trial/extend`, {
      method: 'POST',
      body: JSON.stringify({ days }),
    }).then((r) => json(r)),
  endTrial: (tenantId: string, convert: boolean) =>
    authFetch(`${base}/schools/${tenantId}/trial/end`, {
      method: 'POST',
      body: JSON.stringify({ convert }),
    }).then((r) => json(r)),
};

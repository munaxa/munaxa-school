import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LimitKey, PlanFeature, PlanTier } from '@school/domain';
import { SubscriptionService, toPlanView } from '../../subscription/subscription.service';
import { WebhookService, WebhookEvent } from '../../webhooks/webhook.service';
import { PlatformConsoleRepository } from './platform-console.repository';
import type {
  ChangeSubscriptionDto,
  CreateCouponDto,
  DecideUpgradeRequestDto,
  SetFeatureOverrideDto,
  StartTrialDto,
  UpsertBillingProfileDto,
} from './platform-console.dto';

/**
 * Platform Console orchestration. Thin business layer over {@link PlatformConsoleRepository}:
 * applies subscription lifecycle transitions, resolves upgrade requests (approval applies the
 * plan change so features become active immediately), and computes dashboard/revenue rollups.
 */
@Injectable()
export class PlatformConsoleService {
  constructor(
    private readonly repo: PlatformConsoleRepository,
    private readonly subscriptions: SubscriptionService,
    private readonly webhooks: WebhookService,
  ) {}

  // --- Schools ---------------------------------------------------------------

  async listSchools() {
    const rows = await this.repo.listSchools();
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      plan: t.subscription?.plan
        ? { tier: t.subscription.plan.tier, name: t.subscription.plan.name }
        : null,
      subscriptionStatus: t.subscription?.status ?? 'NONE',
      billingCycle: t.subscription?.billingCycle ?? null,
      renewal: t.subscription?.currentPeriodEnd?.toISOString() ?? null,
      trialEndsAt:
        t.trial && !t.trial.convertedAt && !t.trial.expiredAt ? t.trial.endsAt.toISOString() : null,
      students: t._count.students,
      campuses: t._count.campuses,
      users: t._count.users,
      storageGb: t.usageMetrics.get('storage_gb') ?? 0,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async getSchool(tenantId: string) {
    const t = await this.repo.getSchool(tenantId);
    if (!t) throw new NotFoundException('School not found');
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      counts: t._count,
      subscription: t.subscription
        ? {
            status: t.subscription.status,
            billingCycle: t.subscription.billingCycle,
            currentPeriodEnd: t.subscription.currentPeriodEnd?.toISOString() ?? null,
            trialEndsAt: t.subscription.trialEndsAt?.toISOString() ?? null,
            plan: toPlanView(t.subscription.plan),
            coupon: t.subscription.coupon?.code ?? null,
          }
        : null,
      trial: t.trial
        ? {
            planId: t.trial.planId,
            planName: t.trial.plan.name,
            endsAt: t.trial.endsAt.toISOString(),
            convertedAt: t.trial.convertedAt?.toISOString() ?? null,
            expiredAt: t.trial.expiredAt?.toISOString() ?? null,
          }
        : null,
      billingProfile: t.billingProfile,
      usage: t.subscriptionUsages.map((u) => ({ metric: u.metric, value: u.value })),
      overrides: t.featureOverrides.map((o) => ({
        key: o.key,
        enabled: o.enabled,
        limitOverride: o.limitOverride,
        reason: o.reason,
        expiresAt: o.expiresAt?.toISOString() ?? null,
      })),
      planChanges: t.planChanges.map((c) => ({
        from: c.fromPlan?.name ?? null,
        to: c.toPlan.name,
        toStatus: c.toStatus,
        reason: c.reason,
        createdAt: c.createdAt.toISOString(),
      })),
      upgradeRequests: t.upgradeRequests.map((r) => ({
        id: r.id,
        status: r.status,
        requestedPlan: r.requestedPlan.name,
        fromPlan: r.fromPlan?.name ?? null,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  // --- Subscriptions ---------------------------------------------------------

  listSubscriptions() {
    return this.repo.listSubscriptions();
  }

  async changeSubscription(tenantId: string, dto: ChangeSubscriptionDto) {
    const sub = await this.repo.applyPlanChange({
      tenantId,
      toPlanId: dto.planId,
      billingCycle: dto.billingCycle,
      status: dto.status,
      currentPeriodEnd:
        dto.currentPeriodEnd !== undefined
          ? dto.currentPeriodEnd
            ? new Date(dto.currentPeriodEnd)
            : null
          : undefined,
      reason: dto.reason ?? 'platform change',
    });
    this.subscriptions.invalidate(tenantId);
    await this.webhooks.publish(WebhookEvent.SUBSCRIPTION_UPDATED, {
      tenantId,
      data: { planId: dto.planId, status: sub.status, billingCycle: sub.billingCycle },
    });
    return sub;
  }

  async setStatus(tenantId: string, status: string) {
    const sub = await this.repo.setSubscriptionStatus(tenantId, status);
    this.subscriptions.invalidate(tenantId);
    await this.webhooks.publish(
      status === 'CANCELLED'
        ? WebhookEvent.SUBSCRIPTION_CANCELLED
        : WebhookEvent.SUBSCRIPTION_UPDATED,
      { tenantId, data: { status } },
    );
    return sub;
  }

  // --- Upgrade requests ------------------------------------------------------

  listUpgradeRequests(status?: string) {
    return this.repo.listUpgradeRequests(status);
  }

  async decideUpgradeRequest(id: string, dto: DecideUpgradeRequestDto) {
    const req = await this.repo.getUpgradeRequest(id);
    if (!req) throw new NotFoundException('Upgrade request not found');
    if (req.status !== 'PENDING') {
      throw new BadRequestException(`Request already ${req.status.toLowerCase()}`);
    }

    if (dto.decision === 'APPROVE') {
      await this.repo.applyPlanChange({
        tenantId: req.tenantId,
        toPlanId: req.requestedPlanId,
        billingCycle: req.requestedCycle ?? undefined,
        status: 'ACTIVE',
        reason: 'upgrade request approved',
        upgradeRequestId: req.id,
      });
      this.subscriptions.invalidate(req.tenantId);
      const reviewed = await this.repo.markUpgradeRequestReviewed(id, 'APPROVED', dto.decisionNote);
      await this.webhooks.publish(WebhookEvent.UPGRADE_APPROVED, {
        tenantId: req.tenantId,
        data: { upgradeRequestId: id, requestedPlanId: req.requestedPlanId },
      });
      return reviewed;
    }
    return this.repo.markUpgradeRequestReviewed(id, 'REJECTED', dto.decisionNote);
  }

  // --- Trials ----------------------------------------------------------------

  listTrials() {
    return this.repo.listTrials();
  }

  async startTrial(tenantId: string, dto: StartTrialDto) {
    const trial = await this.repo.startTrial(tenantId, dto.planId, dto.days ?? 14);
    this.subscriptions.invalidate(tenantId);
    await this.webhooks.publish(WebhookEvent.TRIAL_STARTED, {
      tenantId,
      data: { planId: dto.planId, endsAt: trial.endsAt.toISOString() },
    });
    return trial;
  }

  async extendTrial(tenantId: string, days: number) {
    const trial = await this.repo.extendTrial(tenantId, days);
    this.subscriptions.invalidate(tenantId);
    return trial;
  }

  async endTrial(tenantId: string, convert: boolean) {
    const trial = await this.repo.endTrial(tenantId, convert);
    this.subscriptions.invalidate(tenantId);
    await this.webhooks.publish(
      convert ? WebhookEvent.SUBSCRIPTION_UPDATED : WebhookEvent.TRIAL_EXPIRED,
      { tenantId, data: { converted: convert } },
    );
    return trial;
  }

  // --- Billing ---------------------------------------------------------------

  getBillingProfile(tenantId: string) {
    return this.repo.getBillingProfile(tenantId);
  }

  upsertBillingProfile(tenantId: string, dto: UpsertBillingProfileDto) {
    return this.repo.upsertBillingProfile(tenantId, { tenantId, ...dto });
  }

  // --- Coupons ---------------------------------------------------------------

  listCoupons() {
    return this.repo.listCoupons();
  }

  createCoupon(dto: CreateCouponDto) {
    return this.repo.createCoupon(dto);
  }

  updateCoupon(id: string, data: Partial<CreateCouponDto> & { isActive?: boolean }) {
    return this.repo.updateCoupon(id, data);
  }

  // --- Feature overrides -----------------------------------------------------

  listOverrides(tenantId: string) {
    return this.repo.listOverrides(tenantId);
  }

  async setOverride(tenantId: string, dto: SetFeatureOverrideDto) {
    const override = await this.repo.setOverride(tenantId, dto.key, {
      enabled: dto.enabled ?? null,
      limitOverride: dto.limitOverride ?? null,
      reason: dto.reason ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    this.subscriptions.invalidate(tenantId);
    return override;
  }

  async deleteOverride(tenantId: string, key: string) {
    const res = await this.repo.deleteOverride(tenantId, key);
    this.subscriptions.invalidate(tenantId);
    return res;
  }

  // --- Audit -----------------------------------------------------------------

  listAudit(params: { tenantId?: string; action?: string; take?: number }) {
    return this.repo.listAudit(params);
  }

  /**
   * A chronological activity timeline for one school, derived from the Audit Log (every item links
   * back to its audit entry). Reuses the audit log as the source of truth — no parallel store.
   */
  async timeline(tenantId: string) {
    const rows = await this.repo.listAudit({ tenantId, take: 200 });
    return rows.map((r) => ({
      auditId: r.id,
      at: r.createdAt.toISOString(),
      action: r.action,
      title: timelineTitle(r.action),
      entityType: r.entityType,
      entityId: r.entityId,
      actorUserId: r.actorUserId,
    }));
  }

  // --- Plans -----------------------------------------------------------------

  async listPlans() {
    const plans = await this.repo.listPlans();
    return plans.map(toPlanView);
  }

  setPlanFeature(planId: string, key: string, enabled: boolean, limit: number | null) {
    return this.repo.setPlanFeature(planId, key, enabled, limit);
  }

  // --- Dashboard / revenue ---------------------------------------------------

  async dashboard() {
    const m = await this.repo.metrics();
    const byStatus: Record<string, number> = {};
    const byTier: Record<string, number> = {};
    for (const s of m.subs) {
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
      byTier[s.plan.tier] = (byTier[s.plan.tier] ?? 0) + 1;
    }

    // Trial conversion: converted / (converted + expired) — decided trials only.
    const converted = m.trials.filter((t) => t.convertedAt !== null).length;
    const expired = m.trials.filter((t) => t.expiredAt !== null && t.convertedAt === null).length;
    const decidedTrials = converted + expired;
    const trialConversionRate = decidedTrials > 0 ? converted / decidedTrials : null;

    // Usage rollups + "approaching limits" (any dimension ≥ 80% of a finite plan limit).
    const usageByTenant = new Map<string, Map<string, number>>();
    for (const u of m.usageRows) {
      const t = usageByTenant.get(u.tenantId) ?? new Map<string, number>();
      t.set(u.metric, u.value);
      usageByTenant.set(u.tenantId, t);
    }
    const overrideKeys = new Map<string, Set<string>>();
    for (const o of m.overrideRows) {
      const s = overrideKeys.get(o.tenantId) ?? new Set<string>();
      s.add(o.key);
      overrideKeys.set(o.tenantId, s);
    }

    let approachingLimits = 0;
    let jofotaraAdoption = 0;
    let aiAdoption = 0;
    let storageUsageGb = 0;
    let apiTraffic = 0;
    const LIMIT_COLS: Array<[string, 'maxStudents' | 'maxCampuses' | 'maxStaff' | 'storageGb']> = [
      [LimitKey.STUDENTS, 'maxStudents'],
      [LimitKey.CAMPUSES, 'maxCampuses'],
      [LimitKey.STAFF, 'maxStaff'],
      [LimitKey.STORAGE_GB, 'storageGb'],
    ];
    for (const s of m.subs) {
      const usage = usageByTenant.get(s.tenantId) ?? new Map<string, number>();
      const planFeatures = new Set(s.plan.features.filter((f) => f.enabled).map((f) => f.key));
      const overrides = overrideKeys.get(s.tenantId) ?? new Set<string>();
      if (planFeatures.has(PlanFeature.JOFOTARA) || overrides.has(PlanFeature.JOFOTARA)) {
        jofotaraAdoption += 1;
      }
      if (planFeatures.has(PlanFeature.AI_ASSISTANT) || overrides.has(PlanFeature.AI_ASSISTANT)) {
        aiAdoption += 1;
      }
      const near = LIMIT_COLS.some(([metric, col]) => {
        const limit = s.plan[col];
        if (limit === null || limit === 0) return false;
        return (usage.get(metric) ?? 0) / limit >= 0.8;
      });
      if (near) approachingLimits += 1;
    }
    for (const u of m.usageRows) {
      if (u.metric === LimitKey.STORAGE_GB) storageUsageGb += u.value;
      if (u.metric === 'api_calls') apiTraffic += u.value;
    }

    return {
      schools: m.tenantCount,
      subscriptions: m.subs.length,
      pendingUpgradeRequests: m.pendingRequests,
      activeTrials: m.activeTrials,
      trialSchools: m.activeTrials,
      trialConversionRate,
      renewalsThisMonth: m.renewalsThisMonth,
      churnedThisMonth: m.churnedThisMonth,
      failedPayments: m.failedPayments,
      schoolsApproachingLimits: approachingLimits,
      featureAdoption: { jofotara: jofotaraAdoption, ai: aiAdoption },
      storageUsageGb,
      apiTraffic,
      subscriptionsByStatus: byStatus,
      subscriptionsByTier: byTier,
      revenue: this.computeRevenue(m.subs),
    };
  }

  async revenue() {
    const m = await this.repo.metrics();
    return this.computeRevenue(m.subs);
  }

  /** MRR/ARR from active/trialing paid subscriptions (minor currency units). */
  private computeRevenue(
    subs: Array<{
      status: string;
      billingCycle: string;
      plan: { tier: string; priceMonthly: number | null; priceYearly: number | null };
    }>,
  ) {
    let mrr = 0;
    const perTier: Record<string, number> = {};
    for (const s of subs) {
      if (s.status !== 'ACTIVE' && s.status !== 'GRACE_PERIOD' && s.status !== 'PAST_DUE') continue;
      const monthly =
        s.billingCycle === 'YEARLY'
          ? Math.round((s.plan.priceYearly ?? 0) / 12)
          : (s.plan.priceMonthly ?? 0);
      mrr += monthly;
      perTier[s.plan.tier] = (perTier[s.plan.tier] ?? 0) + monthly;
    }
    return { mrr, arr: mrr * 12, currency: 'JOD', perTier };
  }

  /** Convenience: the Professional plan id (used as the default trial target). */
  async professionalPlanId(): Promise<string> {
    const plan = await this.repo.findPlanByTier(PlanTier.PROFESSIONAL);
    if (!plan) throw new NotFoundException('Professional plan not seeded');
    return plan.id;
  }
}

/** Human-readable title for a timeline item, derived from its audit `action`. */
function timelineTitle(action: string): string {
  const TITLES: Record<string, string> = {
    'platform.subscription.change': 'Plan changed',
    'platform.subscription.status': 'Subscription status changed',
    'platform.upgrade_request.approve': 'Upgrade approved',
    'platform.upgrade_request.reject': 'Upgrade rejected',
    'subscription.upgrade_request.create': 'Upgrade requested',
    'platform.trial.start': 'Trial started',
    'platform.trial.extend': 'Trial extended',
    'platform.trial.convert': 'Trial converted',
    'platform.trial.expire': 'Trial expired',
    'platform.feature_override.set': 'Feature override applied',
    'platform.feature_override.delete': 'Feature override removed',
    'platform.billing.upsert': 'Billing profile updated',
    'platform.billing.invoice.create': 'Invoice issued',
    'platform.billing.payment.record': 'Payment received',
    'platform.billing.refund': 'Refund issued',
    'platform.coupon.create': 'Coupon created',
    'tenant.create': 'School created',
    'support.impersonate': 'Support impersonation',
  };
  if (TITLES[action]) return TITLES[action];
  // Fall back to a humanized version of the action key.
  return action
    .replace(/^platform\./, '')
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

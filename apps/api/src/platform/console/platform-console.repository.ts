import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { withPlatform, type TxClient } from '../../prisma/tenant.helpers';
import { TenantContextStore } from '../../prisma/tenant-context';
import { PLATFORM_TENANT_ID } from '../platform.constants';

const planInclude = { features: true } as const;

/** Exclude the reserved platform "home" tenant from customer-facing listings. */
const notPlatformTenant = { id: { not: PLATFORM_TENANT_ID } } as const;

/**
 * Control-plane data access for the Platform Console. Every operation runs under
 * `withPlatform` (cross-tenant RLS) against the shared control-plane database, and every
 * mutation writes an audit entry in the SAME transaction (doc 10 — platform actions MUST
 * be audited). No tenant context is required; the acting platform user is read from the
 * request-scoped {@link TenantContextStore} for attribution.
 */
@Injectable()
export class PlatformConsoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  private client(): PrismaClient {
    return this.prisma;
  }

  private audit(
    tx: TxClient,
    params: {
      tenantId?: string | null;
      action: string;
      entityType: string;
      entityId?: string | null;
      before?: Prisma.InputJsonValue;
      after?: Prisma.InputJsonValue;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<unknown> {
    return tx.auditLog.create({
      data: {
        tenantId: params.tenantId ?? null,
        actorUserId: TenantContextStore.get()?.actorUserId ?? null,
        actorRole: 'platform',
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        ...(params.before !== undefined ? { before: params.before } : {}),
        ...(params.after !== undefined ? { after: params.after } : {}),
        ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
      },
    });
  }

  // --- Plans (global catalog) ------------------------------------------------

  listPlans() {
    return withPlatform(this.client(), (tx) =>
      tx.subscriptionPlan.findMany({ include: planInclude, orderBy: { sortOrder: 'asc' } }),
    );
  }

  findPlanByTier(tier: Prisma.SubscriptionPlanWhereInput['tier']) {
    return withPlatform(this.client(), (tx) =>
      tx.subscriptionPlan.findFirst({ where: { tier }, include: planInclude }),
    );
  }

  createPlan(data: Prisma.SubscriptionPlanUncheckedCreateInput) {
    return withPlatform(this.client(), async (tx) => {
      const plan = await tx.subscriptionPlan.create({ data, include: planInclude });
      await this.audit(tx, {
        action: 'platform.plan.create',
        entityType: 'SubscriptionPlan',
        entityId: plan.id,
        after: { tier: plan.tier, name: plan.name },
      });
      return plan;
    });
  }

  updatePlan(id: string, data: Prisma.SubscriptionPlanUpdateInput) {
    return withPlatform(this.client(), async (tx) => {
      const before = await tx.subscriptionPlan.findUniqueOrThrow({ where: { id } });
      const plan = await tx.subscriptionPlan.update({ where: { id }, data, include: planInclude });
      await this.audit(tx, {
        action: 'platform.plan.update',
        entityType: 'SubscriptionPlan',
        entityId: id,
        before: { name: before.name, isActive: before.isActive },
        after: { name: plan.name, isActive: plan.isActive },
      });
      return plan;
    });
  }

  setPlanFeature(planId: string, key: string, enabled: boolean, limit: number | null) {
    return withPlatform(this.client(), async (tx) => {
      const feature = await tx.subscriptionFeature.upsert({
        where: { planId_key: { planId, key } },
        create: { planId, key, enabled, limit },
        update: { enabled, limit },
      });
      await this.audit(tx, {
        action: 'platform.plan.feature.set',
        entityType: 'SubscriptionFeature',
        entityId: feature.id,
        metadata: { planId, key, enabled, limit },
      });
      return feature;
    });
  }

  // --- Schools (tenants) -----------------------------------------------------

  /** Every tenant with its subscription, plan, and live counts. */
  async listSchools() {
    return withPlatform(this.client(), async (tx) => {
      const tenants = await tx.tenant.findMany({
        where: notPlatformTenant,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: { include: { plan: true } },
          trial: true,
          _count: { select: { students: true, campuses: true, users: true } },
        },
      });
      const usage = await tx.subscriptionUsage.findMany();
      const usageByTenant = new Map<string, Map<string, number>>();
      for (const u of usage) {
        const m = usageByTenant.get(u.tenantId) ?? new Map<string, number>();
        m.set(u.metric, u.value);
        usageByTenant.set(u.tenantId, m);
      }
      return tenants.map((t) => ({
        ...t,
        usageMetrics: usageByTenant.get(t.id) ?? new Map<string, number>(),
      }));
    });
  }

  getSchool(tenantId: string) {
    return withPlatform(this.client(), (tx) =>
      tx.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscription: { include: { plan: { include: planInclude }, coupon: true } },
          trial: { include: { plan: true } },
          billingProfile: true,
          featureOverrides: true,
          subscriptionUsages: true,
          planChanges: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { fromPlan: true, toPlan: true },
          },
          upgradeRequests: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { requestedPlan: true, fromPlan: true },
          },
          _count: { select: { students: true, campuses: true, users: true } },
        },
      }),
    );
  }

  // --- Subscriptions ---------------------------------------------------------

  listSubscriptions() {
    return withPlatform(this.client(), (tx) =>
      tx.tenantSubscription.findMany({
        orderBy: { updatedAt: 'desc' },
        include: { plan: true, tenant: { select: { name: true, slug: true, status: true } } },
      }),
    );
  }

  /**
   * Create or replace a tenant's subscription and record the change. Used by direct platform
   * edits and by upgrade-request approval. Features become active immediately because the
   * resolver reads the plan live. Returns the updated subscription.
   */
  applyPlanChange(params: {
    tenantId: string;
    toPlanId: string;
    billingCycle?: string;
    status?: string;
    currentPeriodEnd?: Date | null;
    reason?: string | null;
    upgradeRequestId?: string | null;
  }) {
    const changedById = TenantContextStore.get()?.actorUserId ?? null;
    return withPlatform(this.client(), async (tx) => {
      const existing = await tx.tenantSubscription.findFirst({
        where: { tenantId: params.tenantId },
      });
      const cycle = (params.billingCycle ?? existing?.billingCycle ?? 'MONTHLY') as never;
      const status = (params.status ?? existing?.status ?? 'ACTIVE') as never;
      const periodEnd =
        params.currentPeriodEnd !== undefined
          ? params.currentPeriodEnd
          : (existing?.currentPeriodEnd ?? defaultPeriodEnd(String(cycle)));

      const subscription = existing
        ? await tx.tenantSubscription.update({
            where: { id: existing.id },
            data: {
              planId: params.toPlanId,
              billingCycle: cycle,
              status,
              currentPeriodEnd: periodEnd,
              ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
            },
            include: { plan: { include: planInclude } },
          })
        : await tx.tenantSubscription.create({
            data: {
              tenantId: params.tenantId,
              planId: params.toPlanId,
              billingCycle: cycle,
              status,
              currentPeriodStart: new Date(),
              currentPeriodEnd: periodEnd,
            },
            include: { plan: { include: planInclude } },
          });

      await tx.planChangeHistory.create({
        data: {
          tenantId: params.tenantId,
          fromPlanId: existing?.planId ?? null,
          toPlanId: params.toPlanId,
          fromStatus: existing?.status ?? null,
          toStatus: String(status),
          fromCycle: existing?.billingCycle ?? null,
          toCycle: String(cycle),
          reason: params.reason ?? null,
          upgradeRequestId: params.upgradeRequestId ?? null,
          changedById,
        },
      });

      await this.audit(tx, {
        tenantId: params.tenantId,
        action: 'platform.subscription.change',
        entityType: 'TenantSubscription',
        entityId: subscription.id,
        before: existing ? { planId: existing.planId, status: existing.status } : undefined,
        after: { planId: params.toPlanId, status: String(status) },
        metadata: { upgradeRequestId: params.upgradeRequestId ?? null },
      });

      return subscription;
    });
  }

  setSubscriptionStatus(tenantId: string, status: string) {
    const actor = TenantContextStore.get()?.actorUserId ?? null;
    return withPlatform(this.client(), async (tx) => {
      const existing = await tx.tenantSubscription.findFirstOrThrow({ where: { tenantId } });
      const sub = await tx.tenantSubscription.update({
        where: { id: existing.id },
        data: {
          status: status as never,
          ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
        },
        include: { plan: true },
      });
      await tx.planChangeHistory.create({
        data: {
          tenantId,
          toPlanId: existing.planId,
          fromStatus: existing.status,
          toStatus: status,
          reason: `status → ${status}`,
          changedById: actor,
        },
      });
      await this.audit(tx, {
        tenantId,
        action: 'platform.subscription.status',
        entityType: 'TenantSubscription',
        entityId: sub.id,
        before: { status: existing.status },
        after: { status },
      });
      return sub;
    });
  }

  // --- Upgrade requests ------------------------------------------------------

  listUpgradeRequests(status?: string) {
    return withPlatform(this.client(), (tx) =>
      tx.upgradeRequest.findMany({
        where: status ? { status: status as never } : {},
        orderBy: { createdAt: 'desc' },
        include: {
          requestedPlan: true,
          fromPlan: true,
          tenant: { select: { name: true, slug: true } },
        },
      }),
    );
  }

  getUpgradeRequest(id: string) {
    return withPlatform(this.client(), (tx) =>
      tx.upgradeRequest.findUnique({ where: { id }, include: { requestedPlan: true } }),
    );
  }

  markUpgradeRequestReviewed(id: string, status: 'APPROVED' | 'REJECTED', decisionNote?: string) {
    const reviewerId = TenantContextStore.get()?.actorUserId ?? null;
    return withPlatform(this.client(), async (tx) => {
      const req = await tx.upgradeRequest.update({
        where: { id },
        data: {
          status,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          decisionNote: decisionNote ?? null,
        },
      });
      await this.audit(tx, {
        tenantId: req.tenantId,
        action: `platform.upgrade_request.${status.toLowerCase()}`,
        entityType: 'UpgradeRequest',
        entityId: req.id,
        after: { status },
      });
      return req;
    });
  }

  // --- Trials ----------------------------------------------------------------

  listTrials() {
    return withPlatform(this.client(), (tx) =>
      tx.trial.findMany({
        orderBy: { endsAt: 'asc' },
        include: { plan: true, tenant: { select: { name: true, slug: true } } },
      }),
    );
  }

  startTrial(tenantId: string, planId: string, days: number) {
    const endsAt = new Date(Date.now() + days * 86_400_000);
    return withPlatform(this.client(), async (tx) => {
      const trial = await tx.trial.upsert({
        where: { tenantId },
        create: { tenantId, planId, endsAt },
        update: { planId, endsAt, expiredAt: null, convertedAt: null },
      });
      // Reflect the trial on the subscription so the resolver sees TRIALING.
      const existing = await tx.tenantSubscription.findFirst({ where: { tenantId } });
      if (existing) {
        await tx.tenantSubscription.update({
          where: { id: existing.id },
          data: { planId, status: 'TRIALING', billingCycle: 'TRIAL', trialEndsAt: endsAt },
        });
      } else {
        await tx.tenantSubscription.create({
          data: {
            tenantId,
            planId,
            status: 'TRIALING',
            billingCycle: 'TRIAL',
            trialEndsAt: endsAt,
          },
        });
      }
      await this.audit(tx, {
        tenantId,
        action: 'platform.trial.start',
        entityType: 'Trial',
        entityId: trial.id,
        metadata: { planId, days },
      });
      return trial;
    });
  }

  extendTrial(tenantId: string, days: number) {
    return withPlatform(this.client(), async (tx) => {
      const trial = await tx.trial.findUniqueOrThrow({ where: { tenantId } });
      const endsAt = new Date(trial.endsAt.getTime() + days * 86_400_000);
      const updated = await tx.trial.update({
        where: { tenantId },
        data: { endsAt, extendedCount: { increment: 1 } },
      });
      const sub = await tx.tenantSubscription.findFirst({ where: { tenantId } });
      if (sub) {
        await tx.tenantSubscription.update({
          where: { id: sub.id },
          data: { trialEndsAt: endsAt },
        });
      }
      await this.audit(tx, {
        tenantId,
        action: 'platform.trial.extend',
        entityType: 'Trial',
        entityId: trial.id,
        metadata: { days },
      });
      return updated;
    });
  }

  endTrial(tenantId: string, convert: boolean) {
    return withPlatform(this.client(), async (tx) => {
      const trial = await tx.trial.findUniqueOrThrow({ where: { tenantId } });
      const updated = await tx.trial.update({
        where: { tenantId },
        data: convert ? { convertedAt: new Date() } : { expiredAt: new Date() },
      });
      const sub = await tx.tenantSubscription.findFirst({ where: { tenantId } });
      if (sub) {
        await tx.tenantSubscription.update({
          where: { id: sub.id },
          data: convert
            ? { status: 'ACTIVE', billingCycle: 'MONTHLY', trialEndsAt: null }
            : { status: 'EXPIRED' },
        });
      }
      await this.audit(tx, {
        tenantId,
        action: convert ? 'platform.trial.convert' : 'platform.trial.expire',
        entityType: 'Trial',
        entityId: trial.id,
      });
      return updated;
    });
  }

  // --- Billing profiles ------------------------------------------------------

  getBillingProfile(tenantId: string) {
    return withPlatform(this.client(), (tx) =>
      tx.billingProfile.findUnique({ where: { tenantId } }),
    );
  }

  upsertBillingProfile(tenantId: string, data: Prisma.BillingProfileUncheckedCreateInput) {
    return withPlatform(this.client(), async (tx) => {
      const { tenantId: _t, ...rest } = data;
      const profile = await tx.billingProfile.upsert({
        where: { tenantId },
        create: { tenantId, ...rest },
        update: rest,
      });
      await this.audit(tx, {
        tenantId,
        action: 'platform.billing.upsert',
        entityType: 'BillingProfile',
        entityId: profile.id,
      });
      return profile;
    });
  }

  // --- Coupons ---------------------------------------------------------------

  listCoupons() {
    return withPlatform(this.client(), (tx) =>
      tx.coupon.findMany({ orderBy: { createdAt: 'desc' } }),
    );
  }

  createCoupon(data: Prisma.CouponUncheckedCreateInput) {
    return withPlatform(this.client(), async (tx) => {
      const coupon = await tx.coupon.create({ data });
      await this.audit(tx, {
        action: 'platform.coupon.create',
        entityType: 'Coupon',
        entityId: coupon.id,
        after: { code: coupon.code },
      });
      return coupon;
    });
  }

  updateCoupon(id: string, data: Prisma.CouponUpdateInput) {
    return withPlatform(this.client(), async (tx) => {
      const coupon = await tx.coupon.update({ where: { id }, data });
      await this.audit(tx, {
        action: 'platform.coupon.update',
        entityType: 'Coupon',
        entityId: id,
      });
      return coupon;
    });
  }

  // --- Feature overrides -----------------------------------------------------

  listOverrides(tenantId: string) {
    return withPlatform(this.client(), (tx) =>
      tx.tenantFeatureOverride.findMany({ where: { tenantId }, orderBy: { key: 'asc' } }),
    );
  }

  setOverride(
    tenantId: string,
    key: string,
    data: {
      enabled?: boolean | null;
      limitOverride?: number | null;
      reason?: string | null;
      expiresAt?: Date | null;
    },
  ) {
    const createdById = TenantContextStore.get()?.actorUserId ?? null;
    return withPlatform(this.client(), async (tx) => {
      const before = await tx.tenantFeatureOverride.findUnique({
        where: { tenantId_key: { tenantId, key } },
      });
      const override = await tx.tenantFeatureOverride.upsert({
        where: { tenantId_key: { tenantId, key } },
        create: {
          tenantId,
          key,
          enabled: data.enabled ?? null,
          limitOverride: data.limitOverride ?? null,
          reason: data.reason ?? null,
          expiresAt: data.expiresAt ?? null,
          createdById,
        },
        update: {
          enabled: data.enabled ?? null,
          limitOverride: data.limitOverride ?? null,
          reason: data.reason ?? null,
          expiresAt: data.expiresAt ?? null,
        },
      });
      await this.audit(tx, {
        tenantId,
        action: 'platform.feature_override.set',
        entityType: 'TenantFeatureOverride',
        entityId: override.id,
        before: before
          ? { enabled: before.enabled, limitOverride: before.limitOverride }
          : undefined,
        after: {
          enabled: override.enabled,
          limitOverride: override.limitOverride,
        },
        metadata: { key },
      });
      return override;
    });
  }

  deleteOverride(tenantId: string, key: string) {
    return withPlatform(this.client(), async (tx) => {
      const override = await tx.tenantFeatureOverride.delete({
        where: { tenantId_key: { tenantId, key } },
      });
      await this.audit(tx, {
        tenantId,
        action: 'platform.feature_override.delete',
        entityType: 'TenantFeatureOverride',
        entityId: override.id,
        metadata: { key },
      });
      return override;
    });
  }

  // --- Audit log (cross-tenant) ----------------------------------------------

  listAudit(params: { tenantId?: string; action?: string; take?: number }) {
    return withPlatform(this.client(), (tx) =>
      tx.auditLog.findMany({
        where: {
          ...(params.tenantId ? { tenantId: params.tenantId } : {}),
          ...(params.action ? { action: { contains: params.action } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(params.take ?? 100, 500),
      }),
    );
  }

  // --- Dashboard / revenue aggregates ---------------------------------------

  async metrics() {
    return withPlatform(this.client(), async (tx) => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const [
        tenantCount,
        subs,
        pendingRequests,
        activeTrials,
        plans,
        trials,
        failedPayments,
        renewalsThisMonth,
        churnedThisMonth,
        usageRows,
        overrideRows,
      ] = await Promise.all([
        tx.tenant.count({ where: notPlatformTenant }),
        tx.tenantSubscription.findMany({ include: { plan: { include: { features: true } } } }),
        tx.upgradeRequest.count({ where: { status: 'PENDING' } }),
        tx.trial.count({ where: { convertedAt: null, expiredAt: null } }),
        tx.subscriptionPlan.findMany(),
        tx.trial.findMany({ select: { convertedAt: true, expiredAt: true } }),
        tx.billingPayment.count({ where: { status: 'FAILED' } }),
        tx.tenantSubscription.count({
          where: { currentPeriodEnd: { gte: monthStart, lt: monthEnd } },
        }),
        tx.tenantSubscription.count({
          where: {
            status: { in: ['CANCELLED', 'EXPIRED'] },
            cancelledAt: { gte: monthStart, lt: monthEnd },
          },
        }),
        tx.subscriptionUsage.findMany(),
        tx.tenantFeatureOverride.findMany({ where: { enabled: true } }),
      ]);
      return {
        tenantCount,
        subs,
        pendingRequests,
        activeTrials,
        plans,
        trials,
        failedPayments,
        renewalsThisMonth,
        churnedThisMonth,
        usageRows,
        overrideRows,
      };
    });
  }
}

/** A sensible default renewal date for a cycle. */
function defaultPeriodEnd(cycle: string): Date {
  const days = cycle === 'YEARLY' ? 365 : cycle === 'TRIAL' ? 14 : 30;
  return new Date(Date.now() + days * 86_400_000);
}

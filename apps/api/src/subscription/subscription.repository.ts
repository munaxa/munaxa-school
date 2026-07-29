import { Injectable } from '@nestjs/common';
import type { SubscriptionPlan, SubscriptionFeature } from '@prisma/client';
import { TenantConnectionManager } from '../prisma/tenant-connection.service';
import { withTenant } from '../prisma/tenant.helpers';
import { TenantContextStore } from '../prisma/tenant-context';
import type { SubscriptionSnapshot } from './subscription.types';

type PlanWithFeatures = SubscriptionPlan & { features: SubscriptionFeature[] };

/**
 * Tenant-scoped reads/writes for the subscription plane. Everything runs under RLS
 * (`withTenant`) against the tenant's own database, so a school can only ever touch
 * its own subscription, usage, overrides, and upgrade requests. The global plan
 * catalog is readable in-context via the catalog RLS policy.
 */
@Injectable()
export class SubscriptionRepository {
  constructor(private readonly connections: TenantConnectionManager) {}

  /** Load the full resolution snapshot for a tenant in a single transaction. */
  async loadSnapshot(tenantId: string): Promise<SubscriptionSnapshot> {
    return withTenant(this.connections.clientFor(tenantId), tenantId, async (tx) => {
      const now = new Date();
      const [subscription, overrideRows, usageRows] = await Promise.all([
        tx.tenantSubscription.findFirst({
          where: { tenantId },
          include: { plan: { include: { features: true } } },
        }),
        tx.tenantFeatureOverride.findMany({ where: { tenantId } }),
        tx.subscriptionUsage.findMany({ where: { tenantId } }),
      ]);

      const overrides = new Map(
        overrideRows
          .filter((o) => o.expiresAt === null || o.expiresAt > now)
          .map((o) => [o.key, o] as const),
      );
      const usage = new Map(usageRows.map((u) => [u.metric, u.value] as const));
      return { subscription, overrides, usage };
    });
  }

  /** All active plans (upgrade options), ordered. */
  listActivePlans(tenantId: string): Promise<PlanWithFeatures[]> {
    return withTenant(this.connections.clientFor(tenantId), tenantId, (tx) =>
      tx.subscriptionPlan.findMany({
        where: { isActive: true },
        include: { features: true },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  }

  /** A single plan by id (must be active + readable in-context). */
  findPlan(tenantId: string, planId: string): Promise<PlanWithFeatures | null> {
    return withTenant(this.connections.clientFor(tenantId), tenantId, (tx) =>
      tx.subscriptionPlan.findFirst({ where: { id: planId }, include: { features: true } }),
    );
  }

  /** The tenant's own pending/decided upgrade requests, newest first. */
  listUpgradeRequests(tenantId: string) {
    return withTenant(this.connections.clientFor(tenantId), tenantId, (tx) =>
      tx.upgradeRequest.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        include: { requestedPlan: true, fromPlan: true },
      }),
    );
  }

  /**
   * Create an upgrade request for the school. The subscription itself is NOT changed —
   * schools can never self-serve a plan change; the Platform Console reviews and applies it.
   * Audited in the same transaction.
   */
  createUpgradeRequest(
    tenantId: string,
    data: { requestedPlanId: string; requestedCycle?: string | null; note?: string | null },
  ) {
    const actorUserId = TenantContextStore.get()?.actorUserId ?? null;
    return withTenant(this.connections.clientFor(tenantId), tenantId, async (tx) => {
      const current = await tx.tenantSubscription.findFirst({
        where: { tenantId },
        select: { planId: true },
      });
      const request = await tx.upgradeRequest.create({
        data: {
          tenantId,
          fromPlanId: current?.planId ?? null,
          requestedPlanId: data.requestedPlanId,
          requestedCycle: (data.requestedCycle as never) ?? null,
          note: data.note ?? null,
          requestedById: actorUserId,
        },
        include: { requestedPlan: true, fromPlan: true },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId,
          action: 'subscription.upgrade_request.create',
          entityType: 'UpgradeRequest',
          entityId: request.id,
          metadata: {
            requestedPlanId: data.requestedPlanId,
            requestedCycle: data.requestedCycle ?? null,
          },
        },
      });
      return request;
    });
  }

  /** Whether the tenant already has an open (PENDING) request for the same plan. */
  hasPendingRequest(tenantId: string, requestedPlanId: string): Promise<boolean> {
    return withTenant(this.connections.clientFor(tenantId), tenantId, async (tx) => {
      const existing = await tx.upgradeRequest.findFirst({
        where: { tenantId, requestedPlanId, status: 'PENDING' },
        select: { id: true },
      });
      return existing !== null;
    });
  }

  /** Set (upsert) a usage counter for a metric. Used by the usage-sync path. */
  setUsage(tenantId: string, metric: string, value: number) {
    return withTenant(this.connections.clientFor(tenantId), tenantId, (tx) =>
      tx.subscriptionUsage.upsert({
        where: { tenantId_metric: { tenantId, metric } },
        create: { tenantId, metric, value },
        update: { value },
      }),
    );
  }

  /** Increment (upsert) a usage counter by a delta. Used for metered dimensions (API/AI traffic). */
  incrementUsage(tenantId: string, metric: string, delta: number) {
    return withTenant(this.connections.clientFor(tenantId), tenantId, (tx) =>
      tx.subscriptionUsage.upsert({
        where: { tenantId_metric: { tenantId, metric } },
        create: { tenantId, metric, value: Math.max(0, delta) },
        update: { value: { increment: delta } },
      }),
    );
  }
}

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { withPlatform, type TxClient } from '../../prisma/tenant.helpers';
import { TenantContextStore } from '../../prisma/tenant-context';

/**
 * Control-plane access to {@link PlanVersion}. Plans are never edited in place: publishing a change
 * creates a new immutable version. Existing customers stay on their purchased version until
 * migrated. Cross-tenant via `withPlatform`; audited.
 */
@Injectable()
export class PlanVersionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private audit(
    tx: TxClient,
    p: {
      action: string;
      entityId: string;
      tenantId?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<unknown> {
    return tx.auditLog.create({
      data: {
        tenantId: p.tenantId ?? null,
        actorUserId: TenantContextStore.get()?.actorUserId ?? null,
        actorRole: 'platform',
        action: p.action,
        entityType: 'PlanVersion',
        entityId: p.entityId,
        ...(p.metadata !== undefined ? { metadata: p.metadata } : {}),
      },
    });
  }

  list(planId: string) {
    return withPlatform(this.prisma, (tx) =>
      tx.planVersion.findMany({ where: { planId }, orderBy: { version: 'desc' } }),
    );
  }

  get(id: string) {
    return withPlatform(this.prisma, (tx) => tx.planVersion.findUnique({ where: { id } }));
  }

  /** Snapshot the plan's current limits + enabled feature codes + legacy pricing into a new version. */
  createSnapshot(planId: string, notes: string | null) {
    return withPlatform(this.prisma, async (tx) => {
      const plan = await tx.subscriptionPlan.findUniqueOrThrow({
        where: { id: planId },
        include: { features: true },
      });
      const last = await tx.planVersion.findFirst({
        where: { planId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const version = await tx.planVersion.create({
        data: {
          planId,
          version: (last?.version ?? 0) + 1,
          isCurrent: false,
          limits: {
            maxStudents: plan.maxStudents,
            maxCampuses: plan.maxCampuses,
            maxStaff: plan.maxStaff,
            storageGb: plan.storageGb,
          },
          featureCodes: plan.features.filter((f) => f.enabled).map((f) => f.key),
          pricing: {
            priceMonthly: plan.priceMonthly,
            priceYearly: plan.priceYearly,
            currency: plan.currency,
          },
          notes,
        },
      });
      await this.audit(tx, {
        action: 'platform.plan_version.create',
        entityId: version.id,
        metadata: { planId, version: version.version },
      });
      return version;
    });
  }

  /** Publish a version: it becomes the current one new customers receive (others un-set). */
  publish(id: string) {
    return withPlatform(this.prisma, async (tx) => {
      const version = await tx.planVersion.findUniqueOrThrow({ where: { id } });
      await tx.planVersion.updateMany({
        where: { planId: version.planId },
        data: { isCurrent: false },
      });
      const updated = await tx.planVersion.update({ where: { id }, data: { isCurrent: true } });
      await this.audit(tx, {
        action: 'platform.plan_version.publish',
        entityId: id,
        metadata: { planId: version.planId, version: version.version },
      });
      return updated;
    });
  }

  /** Retire a version: no longer the current/assignable one (existing customers keep it). */
  retire(id: string) {
    return withPlatform(this.prisma, async (tx) => {
      const updated = await tx.planVersion.update({ where: { id }, data: { isCurrent: false } });
      await this.audit(tx, { action: 'platform.plan_version.retire', entityId: id });
      return updated;
    });
  }

  /** Subscriptions not on the target version (migration candidates). */
  migrationCandidates(planId: string, toVersionId: string) {
    return withPlatform(this.prisma, (tx) =>
      tx.tenantSubscription.findMany({
        where: { planId, OR: [{ planVersionId: null }, { planVersionId: { not: toVersionId } }] },
        include: { tenant: { select: { name: true, slug: true } } },
      }),
    );
  }

  /** Apply the migration: move candidates onto the target version, with history + audit per tenant. */
  migrate(planId: string, toVersionId: string) {
    const changedById = TenantContextStore.get()?.actorUserId ?? null;
    return withPlatform(this.prisma, async (tx) => {
      const version = await tx.planVersion.findUniqueOrThrow({ where: { id: toVersionId } });
      const candidates = await tx.tenantSubscription.findMany({
        where: { planId, OR: [{ planVersionId: null }, { planVersionId: { not: toVersionId } }] },
      });
      for (const sub of candidates) {
        await tx.tenantSubscription.update({
          where: { id: sub.id },
          data: { planVersionId: toVersionId },
        });
        await tx.planChangeHistory.create({
          data: {
            tenantId: sub.tenantId,
            fromPlanId: sub.planId,
            toPlanId: sub.planId,
            fromStatus: sub.status,
            toStatus: sub.status,
            reason: `plan version → v${version.version}`,
            changedById,
          },
        });
        await this.audit(tx, {
          action: 'platform.plan_version.migrate',
          entityId: toVersionId,
          tenantId: sub.tenantId,
          metadata: { version: version.version },
        });
      }
      return { migrated: candidates.length, tenantIds: candidates.map((c) => c.tenantId) };
    });
  }
}

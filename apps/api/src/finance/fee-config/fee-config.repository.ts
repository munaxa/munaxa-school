import { Injectable, NotFoundException } from '@nestjs/common';
import type { BillingPolicy, DiscountRule, GradeFeeSchedule, Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import type { TxClient } from '../../prisma/tenant.helpers';
import { TenantContextStore } from '../../prisma/tenant-context';

const ROUTE_INCLUDE = {
  route: {
    select: {
      id: true,
      name: true,
      description: true,
      round1Time: true,
      round2Time: true,
      disabledAt: true,
    },
  },
} as const;
export type TransportFareWithRoute = Prisma.TransportFareGetPayload<{
  include: typeof ROUTE_INCLUDE;
}>;

/**
 * Enrollment & billing configuration store (Phase 1): grade fee schedules, transport fares,
 * discount rules, and the per-tenant billing policy. Pure tenant-scoped CRUD; every write is
 * audited in the same transaction. Stamps createdBy/updatedBy from the request actor.
 */
@Injectable()
export class FeeConfigRepository extends TenantRepository {
  private actor(): string | null {
    return TenantContextStore.get()?.actorUserId ?? null;
  }

  // ── Grade fee schedules ──
  listGradeFees(academicYearId?: string): Promise<GradeFeeSchedule[]> {
    return this.run((tx) =>
      tx.gradeFeeSchedule.findMany({
        where: academicYearId ? { academicYearId } : {},
        orderBy: [{ effectiveFrom: 'desc' }],
      }),
    );
  }

  createGradeFee(
    data: Omit<Prisma.GradeFeeScheduleUncheckedCreateInput, 'tenantId' | 'createdById'>,
  ): Promise<GradeFeeSchedule> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.gradeFeeSchedule.create({
        data: { ...data, tenantId, createdById: this.actor(), updatedById: this.actor() },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.feeconfig.gradeFee.create',
        entityType: 'GradeFeeSchedule',
        entityId: row.id,
        metadata: { gradeId: row.gradeId, tuitionFee: row.tuitionFee.toString() },
      });
      return row;
    });
  }

  updateGradeFee(id: string, data: Prisma.GradeFeeScheduleUpdateInput): Promise<GradeFeeSchedule> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.gradeFeeSchedule.update({
        where: { id },
        data: { ...data, updatedById: this.actor() },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.feeconfig.gradeFee.update',
        entityType: 'GradeFeeSchedule',
        entityId: id,
      });
      return row;
    });
  }

  // ── Transport fares ──
  // Resolve the fare's fleet route inside the caller's transaction: an explicit routeId wins,
  // otherwise a non-empty name is reused (case-insensitive) or created — keeping the Fleet and
  // Fee-configuration tabs pointing at the same BusRoute. Returns the route id (or null).
  private async resolveRouteId(
    tx: TxClient,
    tenantId: string,
    input: { routeId?: string | null; routeName?: string | null; academicYearId?: string | null },
  ): Promise<string | null> {
    if (input.routeId) {
      const route = await tx.busRoute.findFirst({
        where: { id: input.routeId, deletedAt: null },
        select: { id: true },
      });
      if (!route) throw new NotFoundException('Route not found');
      return route.id;
    }
    const name = input.routeName?.trim();
    if (!name) return null;
    // Reuse a route with the same name in the same academic year, else create one stamped with it.
    const existing = await tx.busRoute.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        academicYearId: input.academicYearId ?? null,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await tx.busRoute.create({
      data: { tenantId, name, academicYearId: input.academicYearId ?? null },
      select: { id: true },
    });
    return created.id;
  }

  listTransportFares(academicYearId?: string): Promise<TransportFareWithRoute[]> {
    return this.run((tx) =>
      tx.transportFare.findMany({
        where: academicYearId ? { academicYearId } : {},
        orderBy: [{ createdAt: 'asc' }],
        include: ROUTE_INCLUDE,
      }),
    );
  }

  createTransportFare(data: {
    academicYearId: string;
    amount: number;
    oneWayPct: number;
    isActive: boolean;
    routeId?: string | null;
    routeName?: string | null;
  }): Promise<TransportFareWithRoute> {
    return this.run(async (tx, tenantId) => {
      const routeId = await this.resolveRouteId(tx, tenantId, data);
      const row = await tx.transportFare.create({
        data: {
          tenantId,
          academicYearId: data.academicYearId,
          routeId,
          amount: data.amount,
          oneWayPct: data.oneWayPct,
          isActive: data.isActive,
          createdById: this.actor(),
          updatedById: this.actor(),
        },
        include: ROUTE_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.feeconfig.transportFare.create',
        entityType: 'TransportFare',
        entityId: row.id,
        metadata: {
          route: row.route?.name ?? null,
          amount: row.amount.toString(),
          oneWayPct: row.oneWayPct.toString(),
        },
      });
      return row;
    });
  }

  updateTransportFare(
    id: string,
    data: {
      academicYearId?: string;
      amount?: number;
      oneWayPct?: number;
      isActive?: boolean;
      routeId?: string | null;
      routeName?: string | null;
    },
  ): Promise<TransportFareWithRoute> {
    return this.run(async (tx, tenantId) => {
      // Only re-resolve the route when the caller actually passed routeId/routeName.
      const reroute = data.routeId !== undefined || data.routeName !== undefined;
      let routeId: string | null | undefined;
      if (reroute) {
        // A new route created here must be stamped with the fare's academic year.
        const academicYearId =
          data.academicYearId ??
          (await tx.transportFare.findUnique({ where: { id }, select: { academicYearId: true } }))
            ?.academicYearId ??
          null;
        routeId = await this.resolveRouteId(tx, tenantId, { ...data, academicYearId });
      }
      const row = await tx.transportFare.update({
        where: { id },
        data: {
          ...(data.academicYearId !== undefined
            ? { academicYear: { connect: { id: data.academicYearId } } }
            : {}),
          ...(data.amount !== undefined ? { amount: data.amount } : {}),
          ...(data.oneWayPct !== undefined ? { oneWayPct: data.oneWayPct } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(routeId !== undefined
            ? routeId === null
              ? { route: { disconnect: true } }
              : { route: { connect: { id: routeId } } }
            : {}),
          updatedById: this.actor(),
        },
        include: ROUTE_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.feeconfig.transportFare.update',
        entityType: 'TransportFare',
        entityId: id,
      });
      return row;
    });
  }

  // Hard-delete a fare. Only the fare row is removed — the shared fleet route is left intact.
  deleteTransportFare(id: string): Promise<void> {
    return this.run(async (tx, tenantId) => {
      await tx.transportFare.delete({ where: { id } });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.feeconfig.transportFare.delete',
        entityType: 'TransportFare',
        entityId: id,
      });
    });
  }

  // ── Discount rules ──
  listDiscountRules(): Promise<DiscountRule[]> {
    return this.run((tx) => tx.discountRule.findMany({ orderBy: { createdAt: 'desc' } }));
  }

  findDiscountRule(id: string): Promise<DiscountRule | null> {
    return this.run((tx) => tx.discountRule.findFirst({ where: { id } }));
  }

  createDiscountRule(
    data: Omit<Prisma.DiscountRuleUncheckedCreateInput, 'tenantId' | 'createdById'>,
  ): Promise<DiscountRule> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.discountRule.create({
        data: { ...data, tenantId, createdById: this.actor(), updatedById: this.actor() },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.feeconfig.discountRule.create',
        entityType: 'DiscountRule',
        entityId: row.id,
        metadata: { name: row.name, type: row.type },
      });
      return row;
    });
  }

  updateDiscountRule(id: string, data: Prisma.DiscountRuleUpdateInput): Promise<DiscountRule> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.discountRule.update({
        where: { id },
        data: { ...data, updatedById: this.actor() },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.feeconfig.discountRule.update',
        entityType: 'DiscountRule',
        entityId: id,
      });
      return row;
    });
  }

  // ── Billing policy (singleton per tenant) ──
  getPolicy(): Promise<BillingPolicy | null> {
    return this.run((tx, tenantId) => tx.billingPolicy.findUnique({ where: { tenantId } }));
  }

  upsertPolicy(
    data: Omit<Prisma.BillingPolicyUncheckedCreateInput, 'tenantId' | 'id' | 'createdById'>,
  ): Promise<BillingPolicy> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.billingPolicy.upsert({
        where: { tenantId },
        create: { ...data, tenantId, createdById: this.actor(), updatedById: this.actor() },
        update: { ...data, updatedById: this.actor() },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.feeconfig.policy.upsert',
        entityType: 'BillingPolicy',
        entityId: row.id,
      });
      return row;
    });
  }
}

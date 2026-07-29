import { Injectable } from '@nestjs/common';
import { type Prisma, type PerformanceCycle, type PerformanceGoal } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';

const REVIEW_INCLUDE = {
  cycle: { select: { id: true, name: true, status: true } },
  employee: { select: { id: true, firstNameEn: true, lastNameEn: true } },
  goals: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.PerformanceReviewInclude;

export type ReviewView = Prisma.PerformanceReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;

@Injectable()
export class PerformanceRepository extends TenantRepository {
  // ----- Cycles --------------------------------------------------------------
  createCycle(
    data: Omit<Prisma.PerformanceCycleUncheckedCreateInput, 'tenantId'>,
  ): Promise<PerformanceCycle> {
    return this.run(async (tx, tenantId) => {
      const cycle = await tx.performanceCycle.create({ data: { ...data, tenantId } });
      await this.writeAudit(tx, tenantId, {
        action: 'performance_cycle.create',
        entityType: 'PerformanceCycle',
        entityId: cycle.id,
      });
      return cycle;
    });
  }
  listCycles(): Promise<PerformanceCycle[]> {
    return this.run((tx) =>
      tx.performanceCycle.findMany({ where: { deletedAt: null }, orderBy: { startDate: 'desc' } }),
    );
  }
  findCycle(id: string): Promise<PerformanceCycle | null> {
    return this.run((tx) => tx.performanceCycle.findFirst({ where: { id, deletedAt: null } }));
  }
  updateCycle(
    id: string,
    data: Prisma.PerformanceCycleUncheckedUpdateInput,
  ): Promise<PerformanceCycle> {
    return this.run(async (tx, tenantId) => {
      const cycle = await tx.performanceCycle.update({ where: { id }, data });
      await this.writeAudit(tx, tenantId, {
        action: 'performance_cycle.update',
        entityType: 'PerformanceCycle',
        entityId: id,
      });
      return cycle;
    });
  }
  softDeleteCycle(id: string): Promise<PerformanceCycle> {
    return this.run(async (tx, tenantId) => {
      const cycle = await tx.performanceCycle.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'performance_cycle.delete',
        entityType: 'PerformanceCycle',
        entityId: id,
      });
      return cycle;
    });
  }

  // ----- Reviews -------------------------------------------------------------
  employeeExists(employeeId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.employee.findFirst({ where: { id: employeeId, deletedAt: null } })) !== null,
    );
  }
  createReview(cycleId: string, employeeId: string): Promise<ReviewView> {
    const reviewerId = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      const review = await tx.performanceReview.create({
        data: { tenantId, cycleId, employeeId, reviewerId },
        include: REVIEW_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'performance_review.create',
        entityType: 'PerformanceReview',
        entityId: review.id,
        metadata: { cycleId, employeeId },
      });
      return review;
    });
  }
  listReviewsForEmployee(employeeId: string): Promise<ReviewView[]> {
    return this.run((tx) =>
      tx.performanceReview.findMany({
        where: { employeeId },
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
    );
  }
  findReview(id: string): Promise<ReviewView | null> {
    return this.run((tx) =>
      tx.performanceReview.findFirst({ where: { id }, include: REVIEW_INCLUDE }),
    );
  }
  updateReview(
    id: string,
    data: Prisma.PerformanceReviewUncheckedUpdateInput,
    action: string,
  ): Promise<ReviewView> {
    return this.run(async (tx, tenantId) => {
      const review = await tx.performanceReview.update({
        where: { id },
        data,
        include: REVIEW_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action,
        entityType: 'PerformanceReview',
        entityId: id,
      });
      return review;
    });
  }

  // ----- Goals ---------------------------------------------------------------
  createGoal(
    reviewId: string,
    employeeId: string,
    data: Omit<Prisma.PerformanceGoalUncheckedCreateInput, 'tenantId' | 'reviewId' | 'employeeId'>,
  ): Promise<PerformanceGoal> {
    return this.run(async (tx, tenantId) => {
      const goal = await tx.performanceGoal.create({
        data: { ...data, tenantId, reviewId, employeeId },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'performance_goal.create',
        entityType: 'PerformanceGoal',
        entityId: goal.id,
        metadata: { reviewId },
      });
      return goal;
    });
  }
  findGoal(id: string): Promise<PerformanceGoal | null> {
    return this.run((tx) => tx.performanceGoal.findFirst({ where: { id } }));
  }
  updateGoal(
    id: string,
    data: Prisma.PerformanceGoalUncheckedUpdateInput,
  ): Promise<PerformanceGoal> {
    return this.run(async (tx, tenantId) => {
      const goal = await tx.performanceGoal.update({ where: { id }, data });
      await this.writeAudit(tx, tenantId, {
        action: 'performance_goal.update',
        entityType: 'PerformanceGoal',
        entityId: id,
      });
      return goal;
    });
  }
  deleteGoal(id: string): Promise<void> {
    return this.run(async (tx, tenantId) => {
      await tx.performanceGoal.delete({ where: { id } });
      await this.writeAudit(tx, tenantId, {
        action: 'performance_goal.delete',
        entityType: 'PerformanceGoal',
        entityId: id,
      });
    });
  }
}

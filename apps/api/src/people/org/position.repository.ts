import { Injectable } from '@nestjs/common';
import { EmploymentStatus, type Position, type Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

const INACTIVE_STATUSES: EmploymentStatus[] = [
  EmploymentStatus.RETIRED,
  EmploymentStatus.RESIGNED,
  EmploymentStatus.TERMINATED,
  EmploymentStatus.ARCHIVED,
];

const DETAIL_INCLUDE = {
  department: { select: { id: true, name: true } },
} satisfies Prisma.PositionInclude;

export type PositionWithRefs = Prisma.PositionGetPayload<{ include: typeof DETAIL_INCLUDE }>;

/** A position plus how many live employees fill it and remaining vacancies (if budgeted). */
export type PositionWithHeadcount = PositionWithRefs & {
  filled: number;
  vacancies: number | null;
};

@Injectable()
export class PositionRepository extends TenantRepository {
  create(data: Omit<Prisma.PositionUncheckedCreateInput, 'tenantId'>): Promise<PositionWithRefs> {
    return this.run(async (tx, tenantId) => {
      const position = await tx.position.create({
        data: { ...data, tenantId },
        include: DETAIL_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'position.create',
        entityType: 'Position',
        entityId: position.id,
      });
      return position;
    });
  }

  async list(): Promise<PositionWithHeadcount[]> {
    return this.run(async (tx) => {
      const positions = await tx.position.findMany({
        where: { deletedAt: null },
        include: DETAIL_INCLUDE,
        orderBy: { title: 'asc' },
      });
      const counts = await tx.employee.groupBy({
        by: ['positionId'],
        where: { deletedAt: null, status: { notIn: INACTIVE_STATUSES }, positionId: { not: null } },
        _count: { _all: true },
      });
      const byPosition = new Map(counts.map((c) => [c.positionId, c._count._all]));
      return positions.map((p) => {
        const filled = byPosition.get(p.id) ?? 0;
        return {
          ...p,
          filled,
          vacancies: p.budgetedHeadcount != null ? Math.max(0, p.budgetedHeadcount - filled) : null,
        };
      });
    });
  }

  findById(id: string): Promise<PositionWithRefs | null> {
    return this.run((tx) =>
      tx.position.findFirst({ where: { id, deletedAt: null }, include: DETAIL_INCLUDE }),
    );
  }

  update(id: string, data: Prisma.PositionUpdateInput): Promise<PositionWithRefs> {
    return this.run(async (tx, tenantId) => {
      const position = await tx.position.update({ where: { id }, data, include: DETAIL_INCLUDE });
      await this.writeAudit(tx, tenantId, {
        action: 'position.update',
        entityType: 'Position',
        entityId: id,
      });
      return position;
    });
  }

  softDelete(id: string): Promise<Position> {
    return this.run(async (tx, tenantId) => {
      const position = await tx.position.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'position.delete',
        entityType: 'Position',
        entityId: id,
      });
      return position;
    });
  }
}

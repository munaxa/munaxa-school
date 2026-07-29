import { Injectable } from '@nestjs/common';
import type { Area, Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

/** Area enriched with its mapped route + how many students live there (Fleet config view). */
export interface AreaWithStats extends Area {
  route: { id: string; name: string; disabledAt: Date | null } | null;
  studentCount: number;
}

@Injectable()
export class AreaRepository extends TenantRepository {
  list(filter: { active?: boolean; transportationAvailable?: boolean }): Promise<AreaWithStats[]> {
    return this.run((tx) =>
      tx.area.findMany({
        where: {
          deletedAt: null,
          ...(filter.active !== undefined ? { active: filter.active } : {}),
          ...(filter.transportationAvailable !== undefined
            ? { transportationAvailable: filter.transportationAvailable }
            : {}),
        },
        orderBy: { name: 'asc' },
        include: {
          route: { select: { id: true, name: true, disabledAt: true } },
          _count: { select: { students: true } },
        },
      }),
    ).then((rows) => rows.map(({ _count, ...a }) => ({ ...a, studentCount: _count.students })));
  }

  create(data: Omit<Prisma.AreaUncheckedCreateInput, 'tenantId'>): Promise<Area> {
    return this.run((tx, tenantId) => tx.area.create({ data: { ...data, tenantId } }));
  }

  find(id: string): Promise<Area | null> {
    return this.run((tx) => tx.area.findFirst({ where: { id, deletedAt: null } }));
  }

  update(id: string, data: Prisma.AreaUncheckedUpdateInput): Promise<Area> {
    return this.run((tx) => tx.area.update({ where: { id }, data }));
  }

  /** Whether a (non-deleted) route exists in this tenant — RLS scopes the lookup. */
  routeExists(routeId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.busRoute.findFirst({ where: { id: routeId, deletedAt: null } })) !== null,
    );
  }
}

import { Injectable } from '@nestjs/common';
import type { Campus, Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { assertRoom, CAPACITY_SCOPE, type Capacity } from '../../subscription/capacity';

@Injectable()
export class CampusRepository extends TenantRepository {
  /**
   * Creates the campus only if one more fits `capacity`, counted and created under the tenant's
   * campuses lock so concurrent creates cannot both take the last place. Returns the new total.
   */
  createWithinCapacity(
    data: Omit<Prisma.CampusUncheckedCreateInput, 'tenantId'>,
    capacity: Capacity,
  ): Promise<{ campus: Campus; total: number }> {
    return this.runSerialized(CAPACITY_SCOPE.campuses, async (tx, tenantId) => {
      const current = await tx.campus.count({ where: { deletedAt: null } });
      assertRoom(capacity, current, 1);
      const campus = await tx.campus.create({ data: { ...data, tenantId } });
      return { campus, total: current + 1 };
    });
  }

  findMany(schoolId?: string): Promise<Campus[]> {
    return this.run((tx) =>
      tx.campus.findMany({
        where: { deletedAt: null, ...(schoolId ? { schoolId } : {}) },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  findById(id: string): Promise<Campus | null> {
    return this.run((tx) => tx.campus.findFirst({ where: { id, deletedAt: null } }));
  }

  update(id: string, data: Prisma.CampusUpdateInput): Promise<Campus> {
    return this.run((tx) => tx.campus.update({ where: { id }, data }));
  }

  /** Soft-deletes the campus and returns how many remain, under the same lock as a create. */
  softDelete(id: string): Promise<number> {
    return this.runSerialized(CAPACITY_SCOPE.campuses, async (tx) => {
      await tx.campus.update({ where: { id }, data: { deletedAt: new Date() } });
      return tx.campus.count({ where: { deletedAt: null } });
    });
  }

  schoolExists(schoolId: string): Promise<boolean> {
    return this.run(async (tx) => {
      const found = await tx.school.findFirst({ where: { id: schoolId, deletedAt: null } });
      return found !== null;
    });
  }
}

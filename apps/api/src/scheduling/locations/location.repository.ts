import { Injectable } from '@nestjs/common';
import type { Prisma, SpecialLocation } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class LocationRepository extends TenantRepository {
  create(
    data: Omit<Prisma.SpecialLocationUncheckedCreateInput, 'tenantId'>,
  ): Promise<SpecialLocation> {
    return this.run((tx, tenantId) => tx.specialLocation.create({ data: { ...data, tenantId } }));
  }

  findMany(campusId?: string): Promise<SpecialLocation[]> {
    return this.run((tx) =>
      tx.specialLocation.findMany({
        where: { deletedAt: null, ...(campusId ? { campusId } : {}) },
        orderBy: { nameEn: 'asc' },
      }),
    );
  }

  findById(id: string): Promise<SpecialLocation | null> {
    return this.run((tx) => tx.specialLocation.findFirst({ where: { id, deletedAt: null } }));
  }

  update(id: string, data: Prisma.SpecialLocationUpdateInput): Promise<SpecialLocation> {
    return this.run((tx) => tx.specialLocation.update({ where: { id }, data }));
  }

  softDelete(id: string): Promise<SpecialLocation> {
    return this.run((tx) =>
      tx.specialLocation.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}

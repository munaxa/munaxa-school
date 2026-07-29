import { Injectable } from '@nestjs/common';
import type { Campus, Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class CampusRepository extends TenantRepository {
  create(data: Omit<Prisma.CampusUncheckedCreateInput, 'tenantId'>): Promise<Campus> {
    return this.run((tx, tenantId) => tx.campus.create({ data: { ...data, tenantId } }));
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

  softDelete(id: string): Promise<Campus> {
    return this.run((tx) => tx.campus.update({ where: { id }, data: { deletedAt: new Date() } }));
  }

  schoolExists(schoolId: string): Promise<boolean> {
    return this.run(async (tx) => {
      const found = await tx.school.findFirst({ where: { id: schoolId, deletedAt: null } });
      return found !== null;
    });
  }
}

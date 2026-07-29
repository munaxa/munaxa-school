import { Injectable } from '@nestjs/common';
import type { Grade, Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class GradeRepository extends TenantRepository {
  create(data: Omit<Prisma.GradeUncheckedCreateInput, 'tenantId'>): Promise<Grade> {
    return this.run((tx, tenantId) => tx.grade.create({ data: { ...data, tenantId } }));
  }

  findMany(campusId?: string): Promise<Grade[]> {
    return this.run((tx) =>
      tx.grade.findMany({
        where: { ...(campusId ? { campusId } : {}) },
        orderBy: { level: 'asc' },
      }),
    );
  }

  findById(id: string): Promise<Grade | null> {
    return this.run((tx) => tx.grade.findFirst({ where: { id } }));
  }

  update(id: string, data: Prisma.GradeUpdateInput): Promise<Grade> {
    return this.run((tx) => tx.grade.update({ where: { id }, data }));
  }

  delete(id: string): Promise<Grade> {
    return this.run((tx) => tx.grade.delete({ where: { id } }));
  }

  campusExists(campusId: string): Promise<boolean> {
    return this.run(async (tx) => {
      const found = await tx.campus.findFirst({ where: { id: campusId, deletedAt: null } });
      return found !== null;
    });
  }
}

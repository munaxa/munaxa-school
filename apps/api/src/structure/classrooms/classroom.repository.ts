import { Injectable } from '@nestjs/common';
import type { Classroom, Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class ClassroomRepository extends TenantRepository {
  create(data: Omit<Prisma.ClassroomUncheckedCreateInput, 'tenantId'>): Promise<Classroom> {
    return this.run((tx, tenantId) => tx.classroom.create({ data: { ...data, tenantId } }));
  }

  findMany(campusId?: string): Promise<Classroom[]> {
    return this.run((tx) =>
      tx.classroom.findMany({
        where: { ...(campusId ? { campusId } : {}) },
        orderBy: { name: 'asc' },
      }),
    );
  }

  findById(id: string): Promise<Classroom | null> {
    return this.run((tx) => tx.classroom.findFirst({ where: { id } }));
  }

  update(id: string, data: Prisma.ClassroomUpdateInput): Promise<Classroom> {
    return this.run((tx) => tx.classroom.update({ where: { id }, data }));
  }

  delete(id: string): Promise<Classroom> {
    return this.run((tx) => tx.classroom.delete({ where: { id } }));
  }

  campusExists(campusId: string): Promise<boolean> {
    return this.run(async (tx) => {
      const found = await tx.campus.findFirst({ where: { id: campusId, deletedAt: null } });
      return found !== null;
    });
  }
}

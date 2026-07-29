import { Injectable } from '@nestjs/common';
import type { Prisma, Semester } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class SemesterRepository extends TenantRepository {
  create(data: Omit<Prisma.SemesterUncheckedCreateInput, 'tenantId'>): Promise<Semester> {
    return this.run((tx, tenantId) => tx.semester.create({ data: { ...data, tenantId } }));
  }

  findMany(academicYearId?: string): Promise<Semester[]> {
    return this.run((tx) =>
      tx.semester.findMany({
        where: { ...(academicYearId ? { academicYearId } : {}) },
        orderBy: { sequence: 'asc' },
      }),
    );
  }

  findById(id: string): Promise<Semester | null> {
    return this.run((tx) => tx.semester.findFirst({ where: { id } }));
  }

  update(id: string, data: Prisma.SemesterUpdateInput): Promise<Semester> {
    return this.run((tx) => tx.semester.update({ where: { id }, data }));
  }

  delete(id: string): Promise<Semester> {
    return this.run((tx) => tx.semester.delete({ where: { id } }));
  }

  academicYearExists(academicYearId: string): Promise<boolean> {
    return this.run(async (tx) => {
      const found = await tx.academicYear.findFirst({ where: { id: academicYearId } });
      return found !== null;
    });
  }
}

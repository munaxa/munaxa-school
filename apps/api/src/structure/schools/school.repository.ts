import { Injectable } from '@nestjs/common';
import type { Prisma, School } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class SchoolRepository extends TenantRepository {
  create(data: Omit<Prisma.SchoolUncheckedCreateInput, 'tenantId'>): Promise<School> {
    return this.run((tx, tenantId) => tx.school.create({ data: { ...data, tenantId } }));
  }

  findMany(): Promise<School[]> {
    return this.run((tx) =>
      tx.school.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' } }),
    );
  }

  findById(id: string): Promise<School | null> {
    return this.run((tx) => tx.school.findFirst({ where: { id, deletedAt: null } }));
  }

  update(id: string, data: Prisma.SchoolUpdateInput): Promise<School> {
    return this.run((tx) => tx.school.update({ where: { id }, data }));
  }

  softDelete(id: string): Promise<School> {
    return this.run((tx) => tx.school.update({ where: { id }, data: { deletedAt: new Date() } }));
  }
}

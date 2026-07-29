import { Injectable } from '@nestjs/common';
import type { Prisma, Subject } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class SubjectRepository extends TenantRepository {
  create(data: Omit<Prisma.SubjectUncheckedCreateInput, 'tenantId'>): Promise<Subject> {
    return this.run((tx, tenantId) => tx.subject.create({ data: { ...data, tenantId } }));
  }

  findMany(includeInactive: boolean): Promise<Subject[]> {
    return this.run((tx) =>
      tx.subject.findMany({
        where: { deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
        orderBy: { nameEn: 'asc' },
      }),
    );
  }

  findById(id: string): Promise<Subject | null> {
    return this.run((tx) => tx.subject.findFirst({ where: { id, deletedAt: null } }));
  }

  update(id: string, data: Prisma.SubjectUpdateInput): Promise<Subject> {
    return this.run((tx) => tx.subject.update({ where: { id }, data }));
  }

  softDelete(id: string): Promise<Subject> {
    return this.run((tx) => tx.subject.update({ where: { id }, data: { deletedAt: new Date() } }));
  }

  /** Count published-plan classes still using this subject (blocks deletion). */
  usageCount(id: string): Promise<number> {
    return this.run((tx) => tx.scheduledClass.count({ where: { subjectId: id } }));
  }
}

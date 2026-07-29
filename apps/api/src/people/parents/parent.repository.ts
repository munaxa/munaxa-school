import { Injectable } from '@nestjs/common';
import type { Parent, Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class ParentRepository extends TenantRepository {
  create(data: Omit<Prisma.ParentUncheckedCreateInput, 'tenantId'>): Promise<Parent> {
    return this.run((tx, tenantId) => tx.parent.create({ data: { ...data, tenantId } }));
  }

  findMany(): Promise<Parent[]> {
    return this.run((tx) =>
      tx.parent.findMany({ where: { deletedAt: null }, orderBy: { lastNameEn: 'asc' } }),
    );
  }

  findById(id: string): Promise<Parent | null> {
    return this.run((tx) => tx.parent.findFirst({ where: { id, deletedAt: null } }));
  }

  /** An active parent holding this mobile number, if any (de-duplication key). */
  findByPhone(phone: string): Promise<Parent | null> {
    return this.run((tx) => tx.parent.findFirst({ where: { phone, deletedAt: null } }));
  }

  /** How many non-deleted students this parent is still linked to as a guardian. */
  countActiveStudents(parentId: string): Promise<number> {
    return this.run((tx) =>
      tx.parentStudent.count({ where: { parentId, student: { deletedAt: null } } }),
    );
  }

  /** Parents linked to a given student (used by the parent portal in later phases). */
  findByStudent(studentId: string): Promise<Parent[]> {
    return this.run((tx) =>
      tx.parent.findMany({ where: { deletedAt: null, studentLinks: { some: { studentId } } } }),
    );
  }

  update(id: string, data: Prisma.ParentUpdateInput): Promise<Parent> {
    return this.run((tx) => tx.parent.update({ where: { id }, data }));
  }

  softDelete(id: string): Promise<Parent> {
    return this.run((tx) => tx.parent.update({ where: { id }, data: { deletedAt: new Date() } }));
  }
}

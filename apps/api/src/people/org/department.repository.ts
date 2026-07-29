import { Injectable } from '@nestjs/common';
import { EmploymentStatus, type Department, type Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

const INACTIVE_STATUSES: EmploymentStatus[] = [
  EmploymentStatus.RETIRED,
  EmploymentStatus.RESIGNED,
  EmploymentStatus.TERMINATED,
  EmploymentStatus.ARCHIVED,
];

const DETAIL_INCLUDE = {
  campus: { select: { id: true, nameEn: true, nameAr: true } },
  parent: { select: { id: true, name: true } },
  head: { select: { id: true, firstNameEn: true, lastNameEn: true } },
} satisfies Prisma.DepartmentInclude;

export type DepartmentWithRefs = Prisma.DepartmentGetPayload<{ include: typeof DETAIL_INCLUDE }>;

/** A department plus its current (non-exited) headcount. */
export type DepartmentWithHeadcount = DepartmentWithRefs & { headcount: number };

@Injectable()
export class DepartmentRepository extends TenantRepository {
  create(
    data: Omit<Prisma.DepartmentUncheckedCreateInput, 'tenantId'>,
  ): Promise<DepartmentWithRefs> {
    return this.run(async (tx, tenantId) => {
      const dept = await tx.department.create({
        data: { ...data, tenantId },
        include: DETAIL_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'department.create',
        entityType: 'Department',
        entityId: dept.id,
      });
      return dept;
    });
  }

  async list(): Promise<DepartmentWithHeadcount[]> {
    return this.run(async (tx) => {
      const departments = await tx.department.findMany({
        where: { deletedAt: null },
        include: DETAIL_INCLUDE,
        orderBy: { name: 'asc' },
      });
      const counts = await tx.employee.groupBy({
        by: ['departmentId'],
        where: {
          deletedAt: null,
          status: { notIn: INACTIVE_STATUSES },
          departmentId: { not: null },
        },
        _count: { _all: true },
      });
      const byDept = new Map(counts.map((c) => [c.departmentId, c._count._all]));
      return departments.map((d) => ({ ...d, headcount: byDept.get(d.id) ?? 0 }));
    });
  }

  findById(id: string): Promise<DepartmentWithRefs | null> {
    return this.run((tx) =>
      tx.department.findFirst({ where: { id, deletedAt: null }, include: DETAIL_INCLUDE }),
    );
  }

  update(id: string, data: Prisma.DepartmentUpdateInput): Promise<DepartmentWithRefs> {
    return this.run(async (tx, tenantId) => {
      const dept = await tx.department.update({ where: { id }, data, include: DETAIL_INCLUDE });
      await this.writeAudit(tx, tenantId, {
        action: 'department.update',
        entityType: 'Department',
        entityId: id,
      });
      return dept;
    });
  }

  softDelete(id: string): Promise<Department> {
    return this.run(async (tx, tenantId) => {
      const dept = await tx.department.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'department.delete',
        entityType: 'Department',
        entityId: id,
      });
      return dept;
    });
  }

  /** Count live employees still attached to a department (blocks hard removal semantics). */
  employeeCount(id: string): Promise<number> {
    return this.run((tx) => tx.employee.count({ where: { departmentId: id, deletedAt: null } }));
  }
}

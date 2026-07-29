import { Injectable } from '@nestjs/common';
import { EmploymentStatus, type Employee, type Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';
import { stampsTerminationDate } from './employee-lifecycle.logic';

/** Relations loaded for the full employee profile (Overview / Employment / Org / History tabs). */
const DETAIL_INCLUDE = {
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
  campus: { select: { id: true, nameEn: true, nameAr: true } },
  manager: { select: { id: true, firstNameEn: true, lastNameEn: true } },
  teacher: { select: { id: true, specialization: true } },
  statusHistory: {
    orderBy: { createdAt: 'desc' as const },
    include: { actor: { select: { id: true, firstNameEn: true, lastNameEn: true, email: true } } },
  },
} satisfies Prisma.EmployeeInclude;

export type EmployeeDetail = Prisma.EmployeeGetPayload<{ include: typeof DETAIL_INCLUDE }>;

/** Relations loaded for directory rows (kept light for list performance). */
const LIST_INCLUDE = {
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
} satisfies Prisma.EmployeeInclude;

export type EmployeeListRow = Prisma.EmployeeGetPayload<{ include: typeof LIST_INCLUDE }>;

export interface EmployeeListFilters {
  q?: string;
  status?: EmploymentStatus;
  departmentId?: string;
  campusId?: string;
  positionId?: string;
  includeInactive?: boolean;
  take: number;
  skip: number;
}

/** Statuses considered "inactive" (hidden from the default directory view). */
const INACTIVE_STATUSES: EmploymentStatus[] = [
  EmploymentStatus.RETIRED,
  EmploymentStatus.RESIGNED,
  EmploymentStatus.TERMINATED,
  EmploymentStatus.ARCHIVED,
];

@Injectable()
export class EmployeeRepository extends TenantRepository {
  /** Create an employee and seed its first EmployeeStatusHistory row + audit, atomically. */
  create(
    data: Omit<Prisma.EmployeeUncheckedCreateInput, 'tenantId'>,
    initialStatus: EmploymentStatus,
  ): Promise<EmployeeDetail> {
    const actorUserId = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      const created = await tx.employee.create({
        data: {
          ...data,
          tenantId,
          status: initialStatus,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
        select: { id: true },
      });
      await tx.employeeStatusHistory.create({
        data: {
          tenantId,
          employeeId: created.id,
          fromStatus: null,
          toStatus: initialStatus,
          reason: 'Employee record created',
          actorUserId,
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'employee.create',
        entityType: 'Employee',
        entityId: created.id,
        metadata: { status: initialStatus },
      });
      // Re-read with relations so the response includes the just-written status-history row.
      return tx.employee.findUniqueOrThrow({ where: { id: created.id }, include: DETAIL_INCLUDE });
    });
  }

  findMany(filters: EmployeeListFilters): Promise<EmployeeListRow[]> {
    return this.run((tx) => {
      const where: Prisma.EmployeeWhereInput = { deletedAt: null };
      if (filters.status) where.status = filters.status;
      else if (!filters.includeInactive) where.status = { notIn: INACTIVE_STATUSES };
      if (filters.departmentId) where.departmentId = filters.departmentId;
      if (filters.campusId) where.campusId = filters.campusId;
      if (filters.positionId) where.positionId = filters.positionId;
      if (filters.q) {
        const q = filters.q.trim();
        where.OR = [
          { firstNameEn: { contains: q, mode: 'insensitive' } },
          { lastNameEn: { contains: q, mode: 'insensitive' } },
          { firstNameAr: { contains: q } },
          { lastNameAr: { contains: q } },
          { jobTitle: { contains: q, mode: 'insensitive' } },
          { employeeNumber: { contains: q, mode: 'insensitive' } },
        ];
      }
      return tx.employee.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: [{ lastNameEn: 'asc' }, { firstNameEn: 'asc' }],
        take: filters.take,
        skip: filters.skip,
      });
    });
  }

  findById(id: string): Promise<EmployeeDetail | null> {
    return this.run((tx) =>
      tx.employee.findFirst({ where: { id, deletedAt: null }, include: DETAIL_INCLUDE }),
    );
  }

  /** Lightweight existence/status probe (no relations) — used by the service before transitions. */
  findBare(id: string): Promise<Employee | null> {
    return this.run((tx) => tx.employee.findFirst({ where: { id, deletedAt: null } }));
  }

  update(id: string, data: Prisma.EmployeeUncheckedUpdateInput): Promise<EmployeeDetail> {
    const actorUserId = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      const employee = await tx.employee.update({
        where: { id },
        data: { ...data, updatedById: actorUserId },
        include: DETAIL_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'employee.update',
        entityType: 'Employee',
        entityId: id,
      });
      return employee;
    });
  }

  /** Apply a validated lifecycle transition atomically: status + history + audit. */
  transitionStatus(
    id: string,
    fromStatus: EmploymentStatus,
    toStatus: EmploymentStatus,
    reason: string | undefined,
    effectiveDate: Date | undefined,
  ): Promise<EmployeeDetail> {
    const actorUserId = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      const employee = await tx.employee.update({
        where: { id },
        data: {
          status: toStatus,
          updatedById: actorUserId,
          ...(stampsTerminationDate(toStatus)
            ? { terminationDate: effectiveDate ?? new Date() }
            : {}),
        },
        include: DETAIL_INCLUDE,
      });
      await tx.employeeStatusHistory.create({
        data: {
          tenantId,
          employeeId: id,
          fromStatus,
          toStatus,
          reason: reason ?? null,
          effectiveDate: effectiveDate ?? null,
          actorUserId,
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'employee.status_change',
        entityType: 'Employee',
        entityId: id,
        metadata: { fromStatus, toStatus, reason: reason ?? null },
      });
      return employee;
    });
  }

  softDelete(id: string): Promise<Employee> {
    const actorUserId = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      const employee = await tx.employee.update({
        where: { id },
        data: { deletedAt: new Date(), updatedById: actorUserId },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'employee.delete',
        entityType: 'Employee',
        entityId: id,
      });
      return employee;
    });
  }
}

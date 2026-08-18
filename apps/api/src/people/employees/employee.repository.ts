import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EmploymentStatus, type Employee, type Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';
import { stampsTerminationDate } from './employee-lifecycle.logic';
import { allocateEmployeeNumber } from './employee-number';

/** Relations loaded for the full employee profile (Overview / Employment / Org / History tabs). */
const DETAIL_INCLUDE = {
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
  campus: { select: { id: true, nameEn: true, nameAr: true } },
  manager: { select: { id: true, firstNameEn: true, lastNameEn: true } },
  teacher: {
    select: {
      id: true,
      specialization: true,
      status: true,
      deletedAt: true,
      subjects: {
        select: { subject: { select: { id: true, nameEn: true, nameAr: true, colorHex: true } } },
        orderBy: { subject: { nameEn: 'asc' as const } },
      },
    },
  },
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
  // The directory says who teaches: the same row the Teachers tab lists, so one person is never
  // two entries.
  teacher: { select: { id: true, specialization: true, deletedAt: true } },
} satisfies Prisma.EmployeeInclude;

export type EmployeeListRow = Prisma.EmployeeGetPayload<{ include: typeof LIST_INCLUDE }>;

/**
 * A closed teaching facet is not a facet. The Teacher row is kept — lessons already taught point
 * at it — but soft-deleted, and Prisma cannot filter a to-one include, so it is dropped here
 * rather than left for every caller to remember.
 */
function withOpenFacet<T extends { teacher: { deletedAt: Date | null } | null }>(row: T): T {
  return row.teacher?.deletedAt ? { ...row, teacher: null } : row;
}

/**
 * What HR says about the teaching facet on this save. Every field is optional: a save that does
 * not mention teaching leaves the facet exactly as it was.
 */
export interface TeachingFacetInput {
  /** true opens (or reopens) the facet, false closes it, undefined leaves it alone. */
  isTeacher?: boolean;
  specialization?: string;
  /** Subjects this teacher instructs; replaces the current set. */
  subjectIds?: string[];
}

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
    teaching: TeachingFacetInput = {},
  ): Promise<EmployeeDetail> {
    const actorUserId = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      // Everyone on staff carries a staff number — payroll, the attendance devices and the staff
      // card all refer to a person by it — so the school issues the next one rather than leaving
      // it to whoever fills the form. A number typed in by hand is still honoured, and still has
      // to be free.
      const employeeNumber = data.employeeNumber
        ? await this.assertNumberFree(tx, tenantId, data.employeeNumber, null)
        : await allocateEmployeeNumber(tx, tenantId);
      const created = await tx.employee.create({
        data: {
          ...data,
          employeeNumber,
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
      await this.syncTeacherFacet(tx, tenantId, created.id, teaching);
      // Re-read with relations so the response includes the just-written status-history row.
      return withOpenFacet(
        await tx.employee.findUniqueOrThrow({ where: { id: created.id }, include: DETAIL_INCLUDE }),
      );
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
      return tx.employee
        .findMany({
          where,
          include: LIST_INCLUDE,
          orderBy: [{ lastNameEn: 'asc' }, { firstNameEn: 'asc' }],
          take: filters.take,
          skip: filters.skip,
        })
        .then((rows) => rows.map(withOpenFacet));
    });
  }

  findById(id: string): Promise<EmployeeDetail | null> {
    return this.run(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id, deletedAt: null },
        include: DETAIL_INCLUDE,
      });
      return employee ? withOpenFacet(employee) : null;
    });
  }

  /** Lightweight existence/status probe (no relations) — used by the service before transitions. */
  findBare(id: string): Promise<Employee | null> {
    return this.run((tx) => tx.employee.findFirst({ where: { id, deletedAt: null } }));
  }

  update(
    id: string,
    data: Prisma.EmployeeUncheckedUpdateInput,
    teaching: TeachingFacetInput = {},
  ): Promise<EmployeeDetail> {
    const actorUserId = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      if (typeof data.employeeNumber === 'string') {
        await this.assertNumberFree(tx, tenantId, data.employeeNumber, id);
      }
      await tx.employee.update({ where: { id }, data: { ...data, updatedById: actorUserId } });
      await this.writeAudit(tx, tenantId, {
        action: 'employee.update',
        entityType: 'Employee',
        entityId: id,
      });
      // After the employee is written, so the facet mirrors the names and staff number just saved.
      await this.syncTeacherFacet(tx, tenantId, id, teaching);
      return withOpenFacet(
        await tx.employee.findUniqueOrThrow({ where: { id }, include: DETAIL_INCLUDE }),
      );
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
      await tx.employee.update({
        where: { id },
        data: {
          status: toStatus,
          updatedById: actorUserId,
          ...(stampsTerminationDate(toStatus)
            ? { terminationDate: effectiveDate ?? new Date() }
            : {}),
        },
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
      // The teaching facet is the same person: a teacher who has left HR has left the classroom.
      await tx.teacher.updateMany({ where: { employeeId: id }, data: { status: toStatus } });
      return withOpenFacet(
        await tx.employee.findUniqueOrThrow({ where: { id }, include: DETAIL_INCLUDE }),
      );
    });
  }

  /**
   * Open, refresh or close the teaching facet of an employee, inside the caller's transaction.
   *
   * A teacher is not a second person: the facet mirrors the identity HR holds — names, staff
   * number, employment status — rather than keeping a copy that drifts from it. Opening the facet
   * is what puts someone on the Teachers tab and in the timetable's teacher picker; closing it
   * takes them off both while leaving every lesson they have already taught untouched.
   */
  private async syncTeacherFacet(
    tx: Prisma.TransactionClient,
    tenantId: string,
    employeeId: string,
    teaching: TeachingFacetInput,
  ): Promise<void> {
    const existing = await tx.teacher.findUnique({ where: { employeeId } });

    if (teaching.isTeacher === false) {
      if (existing && !existing.deletedAt) {
        await tx.teacher.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
        await this.writeAudit(tx, tenantId, {
          action: 'teacher.facet_close',
          entityType: 'Teacher',
          entityId: existing.id,
          metadata: { employeeId },
        });
      }
      return;
    }

    // Nothing asked for and nothing to keep in step.
    const isOpen = existing !== null && existing.deletedAt === null;
    if (teaching.isTeacher !== true && !isOpen) return;

    const employee = await tx.employee.findUniqueOrThrow({ where: { id: employeeId } });
    const identity = {
      firstNameEn: employee.firstNameEn,
      lastNameEn: employee.lastNameEn,
      firstNameAr: employee.firstNameAr,
      lastNameAr: employee.lastNameAr,
      employeeNumber: employee.employeeNumber,
      status: employee.status,
    };

    // A staff number identifies one person, and the teacher table has its own uniqueness on it —
    // usually a legacy teacher row created before HR owned the directory.
    if (identity.employeeNumber) {
      const clash = await tx.teacher.findFirst({
        where: { employeeNumber: identity.employeeNumber, NOT: { employeeId } },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException(
          `Another teacher already uses staff number ${identity.employeeNumber}`,
        );
      }
    }

    const teacher = existing
      ? await tx.teacher.update({
          where: { id: existing.id },
          data: {
            ...identity,
            deletedAt: null,
            ...(teaching.specialization !== undefined
              ? { specialization: teaching.specialization || null }
              : {}),
          },
        })
      : await tx.teacher.create({
          data: {
            tenantId,
            employeeId,
            ...identity,
            specialization: teaching.specialization || null,
          },
        });

    if (!isOpen) {
      await this.writeAudit(tx, tenantId, {
        action: 'teacher.facet_open',
        entityType: 'Teacher',
        entityId: teacher.id,
        metadata: { employeeId },
      });
    }

    if (teaching.subjectIds)
      await this.setTeacherSubjects(tx, tenantId, teacher.id, teaching.subjectIds);
  }

  /** Replace the subjects a teacher instructs, rejecting anything outside this school's catalogue. */
  private async setTeacherSubjects(
    tx: Prisma.TransactionClient,
    tenantId: string,
    teacherId: string,
    subjectIds: string[],
  ): Promise<void> {
    const wanted = [...new Set(subjectIds)];
    const live = await tx.subject.findMany({
      where: { id: { in: wanted }, deletedAt: null },
      select: { id: true },
    });
    if (live.length !== wanted.length) {
      throw new BadRequestException('One or more subjects were not found in this school');
    }
    await tx.teacherSubject.deleteMany({ where: { teacherId, subjectId: { notIn: wanted } } });
    if (wanted.length === 0) return;
    await tx.teacherSubject.createMany({
      data: wanted.map((subjectId) => ({ tenantId, teacherId, subjectId })),
      skipDuplicates: true,
    });
  }

  /** A staff number names one person: refuse a hand-entered one another employee already holds. */
  private async assertNumberFree(
    tx: Prisma.TransactionClient,
    tenantId: string,
    employeeNumber: string,
    exceptEmployeeId: string | null,
  ): Promise<string> {
    const clash = await tx.employee.findFirst({
      where: {
        tenantId,
        employeeNumber,
        ...(exceptEmployeeId ? { NOT: { id: exceptEmployeeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) throw new ConflictException(`Staff number ${employeeNumber} is already in use`);
    return employeeNumber;
  }

  softDelete(id: string): Promise<Employee> {
    const actorUserId = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      const employee = await tx.employee.update({
        where: { id },
        data: { deletedAt: new Date(), updatedById: actorUserId },
      });
      // The teaching facet cannot outlive the person: leaving it open would keep a deleted
      // employee on the Teachers tab and in the timetable's teacher picker.
      await tx.teacher.updateMany({
        where: { employeeId: id, deletedAt: null },
        data: { deletedAt: new Date() },
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

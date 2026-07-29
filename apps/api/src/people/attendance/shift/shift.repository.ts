import { Injectable } from '@nestjs/common';
import type { EmployeeShiftAssignment, Prisma } from '@prisma/client';
import { TenantRepository } from '../../../common/tenant.repository';
import { TenantContextStore } from '../../../prisma/tenant-context';

const SHIFT_INCLUDE = { policy: true } satisfies Prisma.ShiftInclude;
export type ShiftView = Prisma.ShiftGetPayload<{ include: typeof SHIFT_INCLUDE }>;

/** Persistence-only access to shifts and their employee assignments. */
@Injectable()
export class ShiftRepository extends TenantRepository {
  create(data: Prisma.ShiftUncheckedCreateWithoutTenantInput): Promise<ShiftView> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.shift.create({ data: { ...data, tenantId }, include: SHIFT_INCLUDE });
      await this.writeAudit(tx, tenantId, {
        action: 'shift.create',
        entityType: 'Shift',
        entityId: row.id,
        metadata: { name: row.name, kind: row.kind },
      });
      return row;
    });
  }

  update(id: string, data: Prisma.ShiftUncheckedUpdateInput): Promise<ShiftView> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.shift.update({ where: { id }, data, include: SHIFT_INCLUDE });
      await this.writeAudit(tx, tenantId, {
        action: 'shift.update',
        entityType: 'Shift',
        entityId: id,
      });
      return row;
    });
  }

  findById(id: string): Promise<ShiftView | null> {
    return this.run((tx) => tx.shift.findFirst({ where: { id }, include: SHIFT_INCLUDE }));
  }

  list(): Promise<ShiftView[]> {
    return this.run((tx) =>
      tx.shift.findMany({ include: SHIFT_INCLUDE, orderBy: { name: 'asc' } }),
    );
  }

  assign(data: {
    employeeId: string;
    shiftId: string;
    effectiveFrom: Date;
    effectiveTo?: Date | null;
    daysOfWeek?: Prisma.EmployeeShiftAssignmentCreateInput['daysOfWeek'];
  }): Promise<EmployeeShiftAssignment> {
    const actorId = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      const row = await tx.employeeShiftAssignment.create({
        data: {
          tenantId,
          employeeId: data.employeeId,
          shiftId: data.shiftId,
          effectiveFrom: data.effectiveFrom,
          effectiveTo: data.effectiveTo ?? null,
          ...(data.daysOfWeek !== undefined ? { daysOfWeek: data.daysOfWeek } : {}),
          createdById: actorId,
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'shift.assign',
        entityType: 'EmployeeShiftAssignment',
        entityId: row.id,
        metadata: {
          employeeId: data.employeeId,
          shiftId: data.shiftId,
          effectiveFrom: data.effectiveFrom.toISOString().slice(0, 10),
        },
      });
      return row;
    });
  }

  listAssignments(employeeId: string): Promise<EmployeeShiftAssignment[]> {
    return this.run((tx) =>
      tx.employeeShiftAssignment.findMany({
        where: { employeeId },
        orderBy: { effectiveFrom: 'desc' },
      }),
    );
  }

  /**
   * The shift in force for an employee on a date: the assignment whose effective window covers it
   * (latest wins when several do). Returns null when the employee has no shift — callers then skip
   * derivation and keep the caller-supplied values, preserving today's behaviour.
   */
  shiftForEmployeeOn(employeeId: string, date: Date): Promise<ShiftView | null> {
    return this.run(async (tx) => {
      const assignment = await tx.employeeShiftAssignment.findFirst({
        where: {
          employeeId,
          effectiveFrom: { lte: date },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
        },
        orderBy: { effectiveFrom: 'desc' },
        select: { shiftId: true },
      });
      if (!assignment) return null;
      return tx.shift.findFirst({
        where: { id: assignment.shiftId, isActive: true },
        include: SHIFT_INCLUDE,
      });
    });
  }

  employeeExists(employeeId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.employee.findFirst({ where: { id: employeeId, deletedAt: null } })) !== null,
    );
  }
}

import { Injectable } from '@nestjs/common';
import {
  LeaveApprovalDecision,
  StaffLeaveStatus,
  type Prisma,
  type StaffLeaveBalance,
  type StaffLeaveType,
} from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';

const REQUEST_INCLUDE = {
  leaveType: { select: { id: true, name: true, paid: true } },
  employee: { select: { id: true, firstNameEn: true, lastNameEn: true } },
  approvals: { orderBy: { decidedAt: 'asc' as const } },
} satisfies Prisma.StaffLeaveRequestInclude;

export type LeaveRequestView = Prisma.StaffLeaveRequestGetPayload<{
  include: typeof REQUEST_INCLUDE;
}>;

@Injectable()
export class LeaveRepository extends TenantRepository {
  // ----- Leave types --------------------------------------------------------
  createType(
    data: Omit<Prisma.StaffLeaveTypeUncheckedCreateInput, 'tenantId'>,
  ): Promise<StaffLeaveType> {
    return this.run(async (tx, tenantId) => {
      const type = await tx.staffLeaveType.create({ data: { ...data, tenantId } });
      await this.writeAudit(tx, tenantId, {
        action: 'staff_leave_type.create',
        entityType: 'StaffLeaveType',
        entityId: type.id,
      });
      return type;
    });
  }
  listTypes(): Promise<StaffLeaveType[]> {
    return this.run((tx) =>
      tx.staffLeaveType.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    );
  }
  findType(id: string): Promise<StaffLeaveType | null> {
    return this.run((tx) => tx.staffLeaveType.findFirst({ where: { id, deletedAt: null } }));
  }
  updateType(id: string, data: Prisma.StaffLeaveTypeUncheckedUpdateInput): Promise<StaffLeaveType> {
    return this.run(async (tx, tenantId) => {
      const type = await tx.staffLeaveType.update({ where: { id }, data });
      await this.writeAudit(tx, tenantId, {
        action: 'staff_leave_type.update',
        entityType: 'StaffLeaveType',
        entityId: id,
      });
      return type;
    });
  }
  softDeleteType(id: string): Promise<StaffLeaveType> {
    return this.run(async (tx, tenantId) => {
      const type = await tx.staffLeaveType.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'staff_leave_type.delete',
        entityType: 'StaffLeaveType',
        entityId: id,
      });
      return type;
    });
  }

  // ----- Balances -----------------------------------------------------------
  employeeExists(employeeId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.employee.findFirst({ where: { id: employeeId, deletedAt: null } })) !== null,
    );
  }
  listBalances(
    employeeId: string,
  ): Promise<Array<StaffLeaveBalance & { leaveType: StaffLeaveType }>> {
    return this.run((tx) =>
      tx.staffLeaveBalance.findMany({
        where: { employeeId },
        include: { leaveType: true },
        orderBy: [{ year: 'desc' }, { leaveType: { name: 'asc' } }],
      }),
    );
  }
  setBalance(
    employeeId: string,
    leaveTypeId: string,
    year: number,
    entitledDays: number,
  ): Promise<StaffLeaveBalance> {
    return this.run(async (tx, tenantId) => {
      const balance = await tx.staffLeaveBalance.upsert({
        where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
        create: { tenantId, employeeId, leaveTypeId, year, entitledDays },
        update: { entitledDays },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'staff_leave_balance.set',
        entityType: 'StaffLeaveBalance',
        entityId: balance.id,
        metadata: { employeeId, leaveTypeId, year, entitledDays },
      });
      return balance;
    });
  }

  // ----- Requests -----------------------------------------------------------
  createRequest(
    data: Omit<Prisma.StaffLeaveRequestUncheckedCreateInput, 'tenantId'>,
  ): Promise<LeaveRequestView> {
    const requestedById = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      const request = await tx.staffLeaveRequest.create({
        data: { ...data, tenantId, requestedById },
        include: REQUEST_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'staff_leave_request.create',
        entityType: 'StaffLeaveRequest',
        entityId: request.id,
        metadata: { employeeId: request.employeeId, workingDays: request.workingDays.toString() },
      });
      return request;
    });
  }

  listRequests(filters: {
    status?: StaffLeaveStatus;
    employeeId?: string;
    take: number;
  }): Promise<LeaveRequestView[]> {
    return this.run((tx) => {
      const where: Prisma.StaffLeaveRequestWhereInput = {};
      if (filters.status) where.status = filters.status;
      if (filters.employeeId) where.employeeId = filters.employeeId;
      return tx.staffLeaveRequest.findMany({
        where,
        include: REQUEST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: filters.take,
      });
    });
  }

  findRequest(id: string): Promise<LeaveRequestView | null> {
    return this.run((tx) =>
      tx.staffLeaveRequest.findFirst({ where: { id }, include: REQUEST_INCLUDE }),
    );
  }

  /**
   * Record one approval decision, atomically advancing the request and (on final approval)
   * deducting the balance. `balanceDelta` is applied to the matching year's `usedDays`.
   */
  decide(params: {
    requestId: string;
    employeeId: string;
    leaveTypeId: string;
    year: number;
    level: number;
    decision: LeaveApprovalDecision;
    note: string | undefined;
    newStatus: StaffLeaveStatus;
    newLevel: number;
    balanceDelta: number; // days added to usedDays when finally approved (0 otherwise)
  }): Promise<LeaveRequestView> {
    const approverId = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      await tx.staffLeaveApproval.create({
        data: {
          tenantId,
          requestId: params.requestId,
          level: params.level,
          decision: params.decision,
          note: params.note ?? null,
          approverId,
        },
      });
      const finalised =
        params.newStatus === StaffLeaveStatus.APPROVED ||
        params.newStatus === StaffLeaveStatus.REJECTED;
      const request = await tx.staffLeaveRequest.update({
        where: { id: params.requestId },
        data: {
          status: params.newStatus,
          currentLevel: params.newLevel,
          ...(finalised ? { decidedAt: new Date() } : {}),
        },
        include: REQUEST_INCLUDE,
      });
      if (params.balanceDelta !== 0) {
        await this.applyBalanceDelta(
          tx,
          tenantId,
          params.employeeId,
          params.leaveTypeId,
          params.year,
          params.balanceDelta,
        );
      }
      await this.writeAudit(tx, tenantId, {
        action: 'staff_leave_request.decide',
        entityType: 'StaffLeaveRequest',
        entityId: params.requestId,
        metadata: { decision: params.decision, level: params.level, status: params.newStatus },
      });
      return request;
    });
  }

  /** Cancel a request, restoring the balance if it had been approved. */
  cancel(params: {
    requestId: string;
    restore: { employeeId: string; leaveTypeId: string; year: number; days: number } | null;
  }): Promise<LeaveRequestView> {
    return this.run(async (tx, tenantId) => {
      const request = await tx.staffLeaveRequest.update({
        where: { id: params.requestId },
        data: { status: StaffLeaveStatus.CANCELLED, decidedAt: new Date() },
        include: REQUEST_INCLUDE,
      });
      if (params.restore) {
        await this.applyBalanceDelta(
          tx,
          tenantId,
          params.restore.employeeId,
          params.restore.leaveTypeId,
          params.restore.year,
          -params.restore.days,
        );
      }
      await this.writeAudit(tx, tenantId, {
        action: 'staff_leave_request.cancel',
        entityType: 'StaffLeaveRequest',
        entityId: params.requestId,
      });
      return request;
    });
  }

  private async applyBalanceDelta(
    tx: Prisma.TransactionClient,
    tenantId: string,
    employeeId: string,
    leaveTypeId: string,
    year: number,
    delta: number,
  ): Promise<void> {
    await tx.staffLeaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
      create: { tenantId, employeeId, leaveTypeId, year, usedDays: delta },
      update: { usedDays: { increment: delta } },
    });
  }
}

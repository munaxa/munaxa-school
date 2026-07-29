import { Injectable } from '@nestjs/common';
import {
  type AttendanceCorrectionDecision,
  type AttendanceCorrectionStatus,
  type Prisma,
  type StaffAttendanceStatus,
} from '@prisma/client';
import { TenantRepository } from '../../../common/tenant.repository';
import { TenantContextStore } from '../../../prisma/tenant-context';

const CORRECTION_INCLUDE = {
  employee: { select: { id: true, firstNameEn: true, lastNameEn: true, employeeNumber: true } },
  approvals: { orderBy: { level: 'asc' } },
} satisfies Prisma.AttendanceCorrectionRequestInclude;

export type CorrectionView = Prisma.AttendanceCorrectionRequestGetPayload<{
  include: typeof CORRECTION_INCLUDE;
}>;

export interface CreateCorrectionData {
  employeeId: string;
  date: Date;
  requestedStatus: StaffAttendanceStatus;
  requestedCheckInAt?: Date | null;
  requestedCheckOutAt?: Date | null;
  requestedNote?: string | null;
  previousStatus: StaffAttendanceStatus | null;
  reason: string;
  evidenceUrl?: string | null;
  requiredLevels: number;
}

export interface RecordDecisionData {
  requestId: string;
  level: number;
  decision: AttendanceCorrectionDecision;
  note?: string | null;
  newStatus: AttendanceCorrectionStatus;
  newLevel: number;
}

/** Persistence-only access to correction requests and their immutable approval trail. */
@Injectable()
export class AttendanceCorrectionRepository extends TenantRepository {
  create(data: CreateCorrectionData): Promise<CorrectionView> {
    const actorId = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      const row = await tx.attendanceCorrectionRequest.create({
        data: {
          tenantId,
          employeeId: data.employeeId,
          date: data.date,
          requestedStatus: data.requestedStatus,
          requestedCheckInAt: data.requestedCheckInAt ?? null,
          requestedCheckOutAt: data.requestedCheckOutAt ?? null,
          requestedNote: data.requestedNote ?? null,
          previousStatus: data.previousStatus,
          reason: data.reason,
          evidenceUrl: data.evidenceUrl ?? null,
          requiredLevels: data.requiredLevels,
          requestedById: actorId,
        },
        include: CORRECTION_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'staff_attendance.correction.request',
        entityType: 'AttendanceCorrectionRequest',
        entityId: row.id,
        metadata: {
          employeeId: data.employeeId,
          date: data.date.toISOString().slice(0, 10),
          requestedStatus: data.requestedStatus,
          ...(data.previousStatus ? { from: data.previousStatus } : {}),
        },
      });
      return row;
    });
  }

  /** Record one decision and advance the request, atomically with its audit entry. */
  decide(data: RecordDecisionData): Promise<CorrectionView> {
    const actorId = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      await tx.attendanceCorrectionApproval.create({
        data: {
          tenantId,
          requestId: data.requestId,
          level: data.level,
          decision: data.decision,
          note: data.note ?? null,
          decidedById: actorId,
        },
      });
      const row = await tx.attendanceCorrectionRequest.update({
        where: { id: data.requestId },
        data: { status: data.newStatus, currentLevel: data.newLevel },
        include: CORRECTION_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action:
          data.decision === 'APPROVED'
            ? 'staff_attendance.correction.approve'
            : 'staff_attendance.correction.reject',
        entityType: 'AttendanceCorrectionRequest',
        entityId: data.requestId,
        metadata: { level: data.level, status: data.newStatus },
      });
      return row;
    });
  }

  /** Mark an approved request as applied once the change has landed on the attendance row. */
  markApplied(requestId: string): Promise<CorrectionView> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.attendanceCorrectionRequest.update({
        where: { id: requestId },
        data: { status: 'APPLIED', appliedAt: new Date() },
        include: CORRECTION_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'staff_attendance.correction.apply',
        entityType: 'AttendanceCorrectionRequest',
        entityId: requestId,
        metadata: { date: row.date.toISOString().slice(0, 10), status: row.requestedStatus },
      });
      return row;
    });
  }

  cancel(requestId: string): Promise<CorrectionView> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.attendanceCorrectionRequest.update({
        where: { id: requestId },
        data: { status: 'CANCELLED' },
        include: CORRECTION_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'staff_attendance.correction.cancel',
        entityType: 'AttendanceCorrectionRequest',
        entityId: requestId,
      });
      return row;
    });
  }

  findById(id: string): Promise<CorrectionView | null> {
    return this.run((tx) =>
      tx.attendanceCorrectionRequest.findFirst({ where: { id }, include: CORRECTION_INCLUDE }),
    );
  }

  list(filter: {
    status?: AttendanceCorrectionStatus;
    employeeId?: string;
    take?: number;
  }): Promise<CorrectionView[]> {
    return this.run((tx) => {
      const where: Prisma.AttendanceCorrectionRequestWhereInput = {};
      if (filter.status) where.status = filter.status;
      if (filter.employeeId) where.employeeId = filter.employeeId;
      return tx.attendanceCorrectionRequest.findMany({
        where,
        include: CORRECTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: filter.take ?? 200,
      });
    });
  }

  /** The status currently recorded for an employee-day (the value a correction would replace). */
  currentStatusFor(employeeId: string, date: Date): Promise<StaffAttendanceStatus | null> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.staffAttendance.findUnique({
        where: { tenantId_employeeId_date: { tenantId, employeeId, date } },
        select: { status: true },
      });
      return row?.status ?? null;
    });
  }

  employeeExists(employeeId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.employee.findFirst({ where: { id: employeeId, deletedAt: null } })) !== null,
    );
  }
}

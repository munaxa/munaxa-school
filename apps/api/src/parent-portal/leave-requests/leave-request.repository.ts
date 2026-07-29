import { Injectable } from '@nestjs/common';
import type { LeaveRequest, LeaveRequestStatus, Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class LeaveRequestRepository extends TenantRepository {
  create(data: Omit<Prisma.LeaveRequestUncheckedCreateInput, 'tenantId'>): Promise<LeaveRequest> {
    return this.run((tx, tenantId) => tx.leaveRequest.create({ data: { ...data, tenantId } }));
  }

  findById(id: string): Promise<LeaveRequest | null> {
    return this.run((tx) => tx.leaveRequest.findFirst({ where: { id } }));
  }

  /** Requests for a set of students (parent view), optionally filtered by status. */
  findForStudents(studentIds: string[], status?: LeaveRequestStatus): Promise<LeaveRequest[]> {
    return this.run((tx) =>
      tx.leaveRequest.findMany({
        where: { studentId: { in: studentIds }, ...(status ? { status } : {}) },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  /** All requests in the tenant (staff review queue), optionally filtered by status. */
  findAll(status?: LeaveRequestStatus): Promise<LeaveRequest[]> {
    return this.run((tx) =>
      tx.leaveRequest.findMany({
        where: { ...(status ? { status } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    );
  }

  decide(
    id: string,
    status: LeaveRequestStatus,
    reviewedById: string | null,
    reviewNote: string | null,
  ): Promise<LeaveRequest> {
    return this.run((tx, tenantId) =>
      tx.leaveRequest
        .update({
          where: { id },
          data: { status, reviewedById, reviewNote, reviewedAt: new Date() },
        })
        .then(async (updated) => {
          await this.writeAudit(tx, tenantId, {
            action: `leave.${status.toLowerCase()}`,
            entityType: 'LeaveRequest',
            entityId: id,
            metadata: { studentId: updated.studentId, type: updated.type },
          });
          return updated;
        }),
    );
  }

  cancel(id: string): Promise<LeaveRequest> {
    return this.run((tx) =>
      tx.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' } }),
    );
  }
}

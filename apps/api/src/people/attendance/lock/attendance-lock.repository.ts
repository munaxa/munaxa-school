import { Injectable } from '@nestjs/common';
import {
  AttendanceLockStatus,
  type AttendanceLock,
  type AttendanceLockScope,
  type Prisma,
} from '@prisma/client';
import { TenantRepository } from '../../../common/tenant.repository';
import { TenantContextStore } from '../../../prisma/tenant-context';

export interface CreateLockData {
  scope: AttendanceLockScope;
  periodStart: Date;
  periodEnd: Date;
  campusId?: string | null;
  reason?: string | null;
}

/** Persistence-only access to attendance locks. Every write is audited in the same transaction. */
@Injectable()
export class AttendanceLockRepository extends TenantRepository {
  create(data: CreateLockData): Promise<AttendanceLock> {
    const actorId = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      const row = await tx.attendanceLock.create({
        data: {
          tenantId,
          scope: data.scope,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          campusId: data.campusId ?? null,
          reason: data.reason ?? null,
          lockedById: actorId,
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'staff_attendance.lock',
        entityType: 'AttendanceLock',
        entityId: row.id,
        metadata: {
          scope: data.scope,
          periodStart: data.periodStart.toISOString().slice(0, 10),
          periodEnd: data.periodEnd.toISOString().slice(0, 10),
          ...(data.campusId ? { campusId: data.campusId } : {}),
        },
      });
      return row;
    });
  }

  release(id: string, note?: string | null): Promise<AttendanceLock> {
    const actorId = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      const row = await tx.attendanceLock.update({
        where: { id },
        data: {
          status: AttendanceLockStatus.RELEASED,
          releasedById: actorId,
          releasedAt: new Date(),
          releaseNote: note ?? null,
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'staff_attendance.unlock',
        entityType: 'AttendanceLock',
        entityId: row.id,
        metadata: { ...(note ? { note } : {}) },
      });
      return row;
    });
  }

  findById(id: string): Promise<AttendanceLock | null> {
    return this.run((tx) => tx.attendanceLock.findFirst({ where: { id } }));
  }

  list(status?: AttendanceLockStatus): Promise<AttendanceLock[]> {
    return this.run((tx) => {
      const where: Prisma.AttendanceLockWhereInput = status ? { status } : {};
      return tx.attendanceLock.findMany({ where, orderBy: { periodStart: 'desc' } });
    });
  }

  /**
   * Active locks that could cover a date range. Fetched once per write/validation so the pure
   * coverage predicate can be applied in memory (avoids a query per date — no N+1).
   */
  activeCovering(from: Date, to: Date): Promise<AttendanceLock[]> {
    return this.run((tx) =>
      tx.attendanceLock.findMany({
        where: {
          status: AttendanceLockStatus.ACTIVE,
          periodStart: { lte: to },
          periodEnd: { gte: from },
        },
      }),
    );
  }
}

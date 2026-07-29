import { Injectable } from '@nestjs/common';
import type { AttendancePolicy, Prisma } from '@prisma/client';
import { TenantRepository } from '../../../common/tenant.repository';

/** Persistence-only access to attendance policy configuration. */
@Injectable()
export class AttendancePolicyRepository extends TenantRepository {
  create(
    data: Prisma.AttendancePolicyUncheckedCreateWithoutTenantInput,
  ): Promise<AttendancePolicy> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.attendancePolicy.create({ data: { ...data, tenantId } });
      await this.writeAudit(tx, tenantId, {
        action: 'attendance_policy.create',
        entityType: 'AttendancePolicy',
        entityId: row.id,
        metadata: { name: row.name },
      });
      return row;
    });
  }

  update(id: string, data: Prisma.AttendancePolicyUncheckedUpdateInput): Promise<AttendancePolicy> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.attendancePolicy.update({ where: { id }, data });
      await this.writeAudit(tx, tenantId, {
        action: 'attendance_policy.update',
        entityType: 'AttendancePolicy',
        entityId: id,
      });
      return row;
    });
  }

  findById(id: string): Promise<AttendancePolicy | null> {
    return this.run((tx) => tx.attendancePolicy.findFirst({ where: { id } }));
  }

  list(): Promise<AttendancePolicy[]> {
    return this.run((tx) => tx.attendancePolicy.findMany({ orderBy: { name: 'asc' } }));
  }

  /**
   * The policy that applies to a campus: the campus-scoped active policy when one exists, otherwise
   * the tenant default. Returns null when neither is configured (callers fall back to the built-in
   * DEFAULT_ATTENDANCE_POLICY, preserving today's behaviour).
   */
  resolveFor(campusId?: string | null): Promise<AttendancePolicy | null> {
    return this.run(async (tx) => {
      if (campusId) {
        const scoped = await tx.attendancePolicy.findFirst({
          where: { campusId, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        if (scoped) return scoped;
      }
      return tx.attendancePolicy.findFirst({
        where: { isDefault: true, isActive: true, campusId: null },
        orderBy: { createdAt: 'asc' },
      });
    });
  }

  /** Clear the default flag from every other policy (a tenant has at most one default). */
  clearOtherDefaults(keepId: string): Promise<Prisma.BatchPayload> {
    return this.run((tx) =>
      tx.attendancePolicy.updateMany({
        where: { isDefault: true, NOT: { id: keepId } },
        data: { isDefault: false },
      }),
    );
  }
}

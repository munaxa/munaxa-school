import { Injectable } from '@nestjs/common';
import { TenantRepository } from '../../../common/tenant.repository';
import type { AnalyticsRow } from './attendance-analytics.logic';

/**
 * Persistence-only reads for attendance analytics. A single query with the employee + department
 * joined in — flattened here so the pure aggregators never touch Prisma types and no N+1 occurs.
 */
@Injectable()
export class AttendanceAnalyticsRepository extends TenantRepository {
  rowsInRange(from: Date, to: Date, departmentId?: string): Promise<AnalyticsRow[]> {
    return this.run(async (tx) => {
      const rows = await tx.staffAttendance.findMany({
        where: {
          date: { gte: from, lte: to },
          ...(departmentId ? { employee: { departmentId } } : {}),
        },
        select: {
          date: true,
          status: true,
          lateMinutes: true,
          overtimeHours: true,
          employee: {
            select: {
              id: true,
              firstNameEn: true,
              lastNameEn: true,
              departmentId: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { date: 'asc' },
      });

      return rows.map((r) => ({
        employeeId: r.employee.id,
        employeeName: `${r.employee.firstNameEn} ${r.employee.lastNameEn}`,
        departmentId: r.employee.departmentId,
        departmentName: r.employee.department?.name ?? null,
        date: r.date.toISOString().slice(0, 10),
        status: r.status,
        lateMinutes: r.lateMinutes ?? 0,
        overtimeHours: r.overtimeHours === null ? 0 : Number(r.overtimeHours),
      }));
    });
  }
}

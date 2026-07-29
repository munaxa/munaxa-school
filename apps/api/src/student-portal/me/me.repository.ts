import { Injectable } from '@nestjs/common';
import type { GradeRecord, Homework, StudentAttendance } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';

export interface AttendanceSummary {
  PRESENT: number;
  ABSENT: number;
  LATE: number;
  EXCUSED: number;
}

@Injectable()
export class MeRepository extends TenantRepository {
  homeworkForSection(sectionId: string): Promise<Homework[]> {
    return this.run((tx) =>
      tx.homework.findMany({
        where: { sectionId, deletedAt: null },
        orderBy: { dueDate: 'asc' },
        take: 200,
      }),
    );
  }

  upcomingHomeworkCount(sectionId: string, from: Date): Promise<number> {
    return this.run((tx) =>
      tx.homework.count({ where: { sectionId, deletedAt: null, dueDate: { gte: from } } }),
    );
  }

  attendanceHistory(studentId: string): Promise<StudentAttendance[]> {
    return this.run((tx) =>
      tx.studentAttendance.findMany({
        where: { studentId },
        orderBy: [{ date: 'desc' }, { classNumber: 'asc' }],
        take: 200,
      }),
    );
  }

  async attendanceSummary(studentId: string, since: Date): Promise<AttendanceSummary> {
    const rows = await this.run((tx) =>
      tx.studentAttendance.groupBy({
        by: ['status'],
        where: { studentId, date: { gte: since } },
        _count: { _all: true },
      }),
    );
    const summary: AttendanceSummary = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const row of rows) summary[row.status] = row._count._all;
    return summary;
  }

  recentGrades(studentId: string): Promise<GradeRecord[]> {
    return this.run((tx) =>
      tx.gradeRecord.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 5 }),
    );
  }

  unreadNotificationCount(): Promise<number> {
    const userId = TenantContextStore.get()?.actorUserId;
    if (!userId) return Promise.resolve(0);
    return this.run((tx) => tx.notification.count({ where: { userId, readAt: null } }));
  }
}

import { Injectable } from '@nestjs/common';
import { StaffLeaveStatus } from '@prisma/client';
import type { TeacherAttendanceStatus } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

/** The raw facts backing one teacher-day, each read from its canonical owner. */
export interface TeacherDayFacts {
  attendanceStatus: TeacherAttendanceStatus | null;
  onApprovedLeave: boolean;
  hasSubstitution: boolean;
}

/**
 * Persistence-only reads for the teacher-availability read model. Every query targets a table owned
 * by another module — nothing is written, and no fact is copied into a new table.
 *
 * Batched by design: `factsForDate` resolves a whole roster in a fixed number of queries so callers
 * (e.g. the scheduler resolving a day) never trigger N+1.
 */
@Injectable()
export class TeacherAvailabilityRepository extends TenantRepository {
  /** Facts for one teacher on one date. */
  async factsForTeacher(teacherId: string, date: Date): Promise<TeacherDayFacts> {
    const map = await this.factsForDate([teacherId], date);
    return (
      map.get(teacherId) ?? {
        attendanceStatus: null,
        onApprovedLeave: false,
        hasSubstitution: false,
      }
    );
  }

  /**
   * Facts for many teachers on one date, in 3 queries regardless of roster size.
   * Leave is resolved through the Teacher→Employee bridge (leave is an HR concept).
   */
  factsForDate(teacherIds: string[], date: Date): Promise<Map<string, TeacherDayFacts>> {
    return this.run(async (tx) => {
      const result = new Map<string, TeacherDayFacts>();
      if (teacherIds.length === 0) return result;

      const [attendance, substitutions, teachers] = await Promise.all([
        tx.teacherAttendance.findMany({
          where: { teacherId: { in: teacherIds }, date },
          select: { teacherId: true, status: true },
        }),
        tx.scheduleException.findMany({
          where: { date, type: 'SUBSTITUTION', teacherId: { in: teacherIds } },
          select: { teacherId: true },
        }),
        tx.teacher.findMany({
          where: { id: { in: teacherIds }, employeeId: { not: null } },
          select: { id: true, employeeId: true },
        }),
      ]);

      const employeeIds = teachers
        .map((t) => t.employeeId)
        .filter((id): id is string => id !== null);
      const leave = employeeIds.length
        ? await tx.staffLeaveRequest.findMany({
            where: {
              employeeId: { in: employeeIds },
              status: StaffLeaveStatus.APPROVED,
              startDate: { lte: date },
              endDate: { gte: date },
            },
            select: { employeeId: true },
          })
        : [];

      const attendanceBy = new Map(attendance.map((a) => [a.teacherId, a.status]));
      const substitutedIds = new Set(
        substitutions.map((s) => s.teacherId).filter((id): id is string => id !== null),
      );
      const leaveEmployeeIds = new Set(leave.map((l) => l.employeeId));
      const employeeByTeacher = new Map(teachers.map((t) => [t.id, t.employeeId]));

      for (const teacherId of teacherIds) {
        const employeeId = employeeByTeacher.get(teacherId) ?? null;
        result.set(teacherId, {
          attendanceStatus: attendanceBy.get(teacherId) ?? null,
          onApprovedLeave: employeeId !== null && leaveEmployeeIds.has(employeeId),
          hasSubstitution: substitutedIds.has(teacherId),
        });
      }
      return result;
    });
  }
}

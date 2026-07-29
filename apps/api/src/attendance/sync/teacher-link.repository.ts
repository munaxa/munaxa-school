import { Injectable } from '@nestjs/common';
import { TenantRepository } from '../../common/tenant.repository';

/**
 * Persistence-only lookup of the Employee↔Teacher bridge (`Teacher.employeeId`, unique 1:1).
 *
 * Lives in Academics because it reads the academic `Teacher` aggregate. It exists so the sync
 * service never duplicates teacher data — it resolves an id and nothing more (Rule 2: Teacher data
 * is never copied into HR, and HR ids are never copied into Academics).
 */
@Injectable()
export class TeacherLinkRepository extends TenantRepository {
  /** The Teacher id linked to an HR Employee, or null when the employee does not teach. */
  teacherIdForEmployee(employeeId: string): Promise<string | null> {
    return this.run(async (tx) => {
      const teacher = await tx.teacher.findFirst({
        where: { employeeId, deletedAt: null },
        select: { id: true },
      });
      return teacher?.id ?? null;
    });
  }

  /** The HR Employee id behind a Teacher, or null when the teacher has no HR record. */
  employeeIdForTeacher(teacherId: string): Promise<string | null> {
    return this.run(async (tx) => {
      const teacher = await tx.teacher.findFirst({
        where: { id: teacherId, deletedAt: null },
        select: { employeeId: true },
      });
      return teacher?.employeeId ?? null;
    });
  }
}

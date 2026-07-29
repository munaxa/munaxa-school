import { Injectable } from '@nestjs/common';
import type { TeacherAttendance, TeacherAttendanceStatus } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

export interface UpsertTeacherMark {
  teacherId: string;
  date: Date;
  status: TeacherAttendanceStatus;
  checkInAt: Date | null;
  note: string | null;
  markedById: string | null;
}

@Injectable()
export class TeacherAttendanceRepository extends TenantRepository {
  upsert(mark: UpsertTeacherMark): Promise<TeacherAttendance> {
    return this.run((tx, tenantId) =>
      tx.teacherAttendance.upsert({
        where: {
          tenantId_teacherId_date: { tenantId, teacherId: mark.teacherId, date: mark.date },
        },
        update: {
          status: mark.status,
          checkInAt: mark.checkInAt,
          note: mark.note,
          markedById: mark.markedById,
        },
        create: { ...mark, tenantId },
      }),
    );
  }

  findForDate(date: Date): Promise<TeacherAttendance[]> {
    return this.run((tx) =>
      tx.teacherAttendance.findMany({ where: { date }, orderBy: { recordedAt: 'asc' } }),
    );
  }

  teacherExists(teacherId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.teacher.findFirst({ where: { id: teacherId, deletedAt: null } })) !== null,
    );
  }
}

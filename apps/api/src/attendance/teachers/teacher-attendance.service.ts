import { BadRequestException, Injectable } from '@nestjs/common';
import type { TeacherAttendance } from '@prisma/client';
import { TeacherAttendanceRepository } from './teacher-attendance.repository';
import { TenantContextStore } from '../../prisma/tenant-context';
import type { MarkTeacherAttendanceDto } from './teacher-attendance.dto';

@Injectable()
export class TeacherAttendanceService {
  constructor(private readonly repo: TeacherAttendanceRepository) {}

  async mark(dto: MarkTeacherAttendanceDto): Promise<TeacherAttendance> {
    if (!(await this.repo.teacherExists(dto.teacherId))) {
      throw new BadRequestException('Teacher not found in this tenant');
    }
    const d = new Date(dto.date);
    return this.repo.upsert({
      teacherId: dto.teacherId,
      date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
      status: dto.status,
      checkInAt: dto.checkInAt ? new Date(dto.checkInAt) : null,
      note: dto.note ?? null,
      markedById: TenantContextStore.get()?.actorUserId ?? null,
    });
  }

  listForDate(date: string): Promise<TeacherAttendance[]> {
    const d = new Date(date);
    return this.repo.findForDate(
      new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
    );
  }
}

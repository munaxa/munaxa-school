import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AttendanceStatus, StudentAttendance } from '@prisma/client';
import { StudentAttendanceRepository, type UpsertMark } from './student-attendance.repository';
import { SchedulingService } from '../../scheduling/scheduling.service';
import { TenantContextStore } from '../../prisma/tenant-context';
import type { BulkMarkDto, QrMarkDto } from './student-attendance.dto';

export interface AttendanceSummary {
  date: string;
  classNumber: number;
  counts: Record<AttendanceStatus, number>;
  total: number;
}

@Injectable()
export class StudentAttendanceService {
  constructor(
    private readonly repo: StudentAttendanceRepository,
    private readonly scheduling: SchedulingService,
  ) {}

  /**
   * The class attendance is currently being taken for — resolved from the published timetable, not
   * asked of the marker. Returns the live current/next class (subject, teacher, class number).
   */
  currentClass(sectionId: string) {
    return this.scheduling.getCurrentSectionClass(sectionId);
  }

  /** Idempotent bulk marking — the target for online marking and offline-queue sync. */
  async bulkMark(dto: BulkMarkDto): Promise<{ marked: number }> {
    if (!(await this.repo.sectionExists(dto.sectionId))) {
      throw new BadRequestException('Section not found in this tenant');
    }
    const date = toDate(dto.date);
    const classNumber = dto.classNumber ?? 0;
    const markedById = TenantContextStore.get()?.actorUserId ?? null;

    const marks: UpsertMark[] = dto.records.map((record) => ({
      studentId: record.studentId,
      sectionId: dto.sectionId,
      date,
      classNumber,
      status: record.status,
      method: record.method ?? 'MANUAL',
      note: record.note ?? null,
      clientRef: record.clientRef ?? null,
      markedById,
    }));
    const result = await this.repo.upsertMany(marks);
    return { marked: result.length };
  }

  /** QR attendance: resolve the student by QR code and mark them (default PRESENT). */
  async markByQr(dto: QrMarkDto): Promise<StudentAttendance> {
    const student = await this.repo.findStudentByQr(dto.qrCode);
    if (!student) throw new NotFoundException('No student matches this QR code');
    if (!student.sectionId) {
      throw new BadRequestException('Student is not assigned to a section');
    }
    return this.repo.upsert({
      studentId: student.id,
      sectionId: student.sectionId,
      date: dto.date ? toDate(dto.date) : toDate(new Date().toISOString()),
      classNumber: dto.classNumber ?? 0,
      status: dto.status ?? 'PRESENT',
      method: 'QR',
      note: null,
      clientRef: null,
      markedById: TenantContextStore.get()?.actorUserId ?? null,
    });
  }

  listForSection(
    sectionId: string,
    date: string,
    classNumber?: number,
  ): Promise<StudentAttendance[]> {
    return this.repo.findForSectionDate(sectionId, toDate(date), classNumber);
  }

  async studentHistory(
    studentId: string,
    from?: string,
    to?: string,
  ): Promise<StudentAttendance[]> {
    const student = await this.repo.studentInTenant(studentId);
    if (!student) throw new NotFoundException('Student not found');
    return this.repo.findForStudent(
      studentId,
      from ? toDate(from) : undefined,
      to ? toDate(to) : undefined,
    );
  }

  async summary(sectionId: string, date: string, classNumber = 0): Promise<AttendanceSummary> {
    const rows = await this.repo.findForSectionDate(sectionId, toDate(date), classNumber);
    const counts: Record<AttendanceStatus, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const row of rows) {
      counts[row.status] += 1;
    }
    return { date, classNumber, counts, total: rows.length };
  }
}

function toDate(iso: string): Date {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

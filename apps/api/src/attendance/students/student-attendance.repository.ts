import { Injectable } from '@nestjs/common';
import type { AttendanceStatus, Student, StudentAttendance } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

export interface UpsertMark {
  studentId: string;
  sectionId: string;
  date: Date;
  classNumber: number;
  status: AttendanceStatus;
  method: 'MANUAL' | 'QR';
  note: string | null;
  clientRef: string | null;
  markedById: string | null;
}

@Injectable()
export class StudentAttendanceRepository extends TenantRepository {
  /** Idempotent upsert on (tenantId, studentId, date, classNumber). */
  upsert(mark: UpsertMark): Promise<StudentAttendance> {
    return this.run((tx, tenantId) =>
      tx.studentAttendance.upsert({
        where: {
          tenantId_studentId_date_classNumber: {
            tenantId,
            studentId: mark.studentId,
            date: mark.date,
            classNumber: mark.classNumber,
          },
        },
        update: {
          status: mark.status,
          method: mark.method,
          note: mark.note,
          markedById: mark.markedById,
          clientRef: mark.clientRef,
        },
        create: { ...mark, tenantId },
      }),
    );
  }

  /** Upsert many in a single transaction (the bulk/offline-sync path). */
  upsertMany(marks: UpsertMark[]): Promise<StudentAttendance[]> {
    return this.run((tx, tenantId) =>
      Promise.all(
        marks.map((mark) =>
          tx.studentAttendance.upsert({
            where: {
              tenantId_studentId_date_classNumber: {
                tenantId,
                studentId: mark.studentId,
                date: mark.date,
                classNumber: mark.classNumber,
              },
            },
            update: {
              status: mark.status,
              method: mark.method,
              note: mark.note,
              markedById: mark.markedById,
              clientRef: mark.clientRef,
            },
            create: { ...mark, tenantId },
          }),
        ),
      ),
    );
  }

  findForSectionDate(
    sectionId: string,
    date: Date,
    classNumber?: number,
  ): Promise<StudentAttendance[]> {
    return this.run((tx) =>
      tx.studentAttendance.findMany({
        where: { sectionId, date, ...(classNumber !== undefined ? { classNumber } : {}) },
        orderBy: { recordedAt: 'asc' },
      }),
    );
  }

  findForStudent(studentId: string, from?: Date, to?: Date): Promise<StudentAttendance[]> {
    return this.run((tx) =>
      tx.studentAttendance.findMany({
        where: {
          studentId,
          ...(from || to
            ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
            : {}),
        },
        orderBy: { date: 'desc' },
      }),
    );
  }

  findStudentByQr(qrCode: string): Promise<Student | null> {
    return this.run((tx) => tx.student.findFirst({ where: { qrCode, deletedAt: null } }));
  }

  studentInTenant(studentId: string): Promise<Student | null> {
    return this.run((tx) => tx.student.findFirst({ where: { id: studentId, deletedAt: null } }));
  }

  sectionExists(sectionId: string): Promise<boolean> {
    return this.run(
      async (tx) => (await tx.section.findFirst({ where: { id: sectionId } })) !== null,
    );
  }
}

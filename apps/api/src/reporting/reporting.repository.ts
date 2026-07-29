import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantRepository } from '../common/tenant.repository';

export interface ReportStudent {
  id: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  sectionId: string | null;
}

export interface DateRange {
  from?: Date;
  to?: Date;
}

@Injectable()
export class ReportingRepository extends TenantRepository {
  /** Active students, optionally restricted to a section. */
  students(sectionId?: string): Promise<ReportStudent[]> {
    return this.run((tx) =>
      tx.student.findMany({
        where: { deletedAt: null, ...(sectionId ? { sectionId } : {}) },
        select: {
          id: true,
          firstNameEn: true,
          lastNameEn: true,
          firstNameAr: true,
          lastNameAr: true,
          sectionId: true,
        },
        orderBy: { lastNameEn: 'asc' },
      }),
    );
  }

  private dateFilter(range: DateRange): Prisma.DateTimeFilter | undefined {
    if (!range.from && !range.to) return undefined;
    return {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    };
  }

  attendanceCounts(studentIds: string[], range: DateRange) {
    const date = this.dateFilter(range);
    return this.run((tx) =>
      tx.studentAttendance.groupBy({
        by: ['studentId', 'status'],
        where: { studentId: { in: studentIds }, ...(date ? { date } : {}) },
        _count: { _all: true },
      }),
    );
  }

  behaviorCounts(studentIds: string[], range: DateRange) {
    const date = this.dateFilter(range);
    return this.run((tx) =>
      tx.behaviorLog.groupBy({
        by: ['studentId', 'type'],
        where: { studentId: { in: studentIds }, ...(date ? { date } : {}) },
        _count: { _all: true },
        _sum: { points: true },
      }),
    );
  }

  gradeRecords(
    studentIds: string[],
    filter: { sectionId?: string; semesterId?: string },
  ): Promise<Array<{ studentId: string; score: Prisma.Decimal; maxScore: Prisma.Decimal }>> {
    return this.run((tx) =>
      tx.gradeRecord.findMany({
        where: {
          studentId: { in: studentIds },
          ...(filter.sectionId ? { sectionId: filter.sectionId } : {}),
          ...(filter.semesterId ? { semesterId: filter.semesterId } : {}),
        },
        select: { studentId: true, score: true, maxScore: true },
      }),
    );
  }

  chargeSums(studentIds: string[]) {
    return this.run((tx) =>
      tx.charge.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, status: { notIn: ['CANCELLED', 'WAIVED'] } },
        _sum: { amount: true },
      }),
    );
  }

  verifiedPaymentSums(studentIds: string[]) {
    return this.run((tx) =>
      tx.payment.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, status: 'VERIFIED' },
        _sum: { amount: true },
      }),
    );
  }
}

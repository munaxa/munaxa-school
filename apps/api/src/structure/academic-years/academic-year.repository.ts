import { Injectable } from '@nestjs/common';
import {
  AcademicYearStatus,
  ChargeStatus,
  EnrollmentStatus,
  PaymentStatus,
  AttendanceStatus,
  type AcademicYear,
  type Prisma,
} from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

/** Aggregated operational metrics for a single Academic Year (read-only; never mutates). */
export interface AcademicYearMetrics {
  studentCount: number;
  activeEnrollments: number;
  graduatingStudents: number;
  withdrawnStudents: number;
  classCount: number;
  gradeCount: number;
  semesterCount: number;
  outstandingFees: string;
  unverifiedPayments: number;
  attendancePct: number | null;
  reportCardCompletionPct: number | null;
  timetableCompletionPct: number | null;
}

/** Existence flags used to decide whether an Academic Year may be deleted. */
export interface AcademicYearUsage {
  enrollments: number;
  charges: number;
  semesters: number;
  reports: number;
  timetable: number;
  auditLogs: number;
}

/** Setup-completeness signals used by the activation validator + readiness score. */
export interface AcademicYearSetup {
  /** Semesters ordered by start date — the authoritative instructional boundaries. */
  semesters: { startDate: Date; endDate: Date }[];
  gradeCount: number;
  sectionCount: number;
}

@Injectable()
export class AcademicYearRepository extends TenantRepository {
  create(data: Omit<Prisma.AcademicYearUncheckedCreateInput, 'tenantId'>): Promise<AcademicYear> {
    return this.run((tx, tenantId) => tx.academicYear.create({ data: { ...data, tenantId } }));
  }

  findMany(campusId?: string): Promise<AcademicYear[]> {
    return this.run((tx) =>
      tx.academicYear.findMany({
        where: { ...(campusId ? { campusId } : {}) },
        orderBy: { startDate: 'desc' },
      }),
    );
  }

  findById(id: string): Promise<AcademicYear | null> {
    return this.run((tx) => tx.academicYear.findFirst({ where: { id } }));
  }

  update(id: string, data: Prisma.AcademicYearUpdateInput): Promise<AcademicYear> {
    return this.run((tx) => tx.academicYear.update({ where: { id }, data }));
  }

  /** Hard-delete a year. The service only calls this for a COMPLETELY unused year (Decision 8). */
  delete(id: string): Promise<AcademicYear> {
    return this.run((tx) => tx.academicYear.delete({ where: { id } }));
  }

  /**
   * Supersede any OTHER active year in the same School before marking a new one ACTIVE — an Academic
   * Year is School-scoped (Decision 1) and there is exactly one ACTIVE per School. A superseded year
   * is moved to CLOSED (and its legacy `isCurrent` flag cleared). Falls back to campus scope only for
   * legacy rows whose `schoolId` has not been backfilled yet.
   */
  clearActiveForSchool(
    schoolId: string | null,
    campusId: string,
    exceptId?: string,
  ): Promise<unknown> {
    return this.run((tx) =>
      tx.academicYear.updateMany({
        where: {
          ...(schoolId ? { schoolId } : { campusId }),
          ...(exceptId ? { id: { not: exceptId } } : {}),
          OR: [{ status: AcademicYearStatus.ACTIVE }, { isCurrent: true }],
        },
        data: { status: AcademicYearStatus.CLOSED, isCurrent: false },
      }),
    );
  }

  /** Resolve the owning School of a campus (for deriving `schoolId` on create). */
  campusSchoolId(campusId: string): Promise<string | null> {
    return this.run(async (tx) => {
      const campus = await tx.campus.findFirst({
        where: { id: campusId, deletedAt: null },
        select: { schoolId: true },
      });
      return campus?.schoolId ?? null;
    });
  }

  campusExists(campusId: string): Promise<boolean> {
    return this.run(async (tx) => {
      const found = await tx.campus.findFirst({ where: { id: campusId, deletedAt: null } });
      return found !== null;
    });
  }

  /** Find the ACTIVE (current) year for a school — or the whole tenant if `schoolId` is null. */
  findActive(schoolId?: string): Promise<AcademicYear | null> {
    return this.run((tx) =>
      tx.academicYear.findFirst({
        where: { status: AcademicYearStatus.ACTIVE, ...(schoolId ? { schoolId } : {}) },
        orderBy: { startDate: 'desc' },
      }),
    );
  }

  /**
   * Compute the operational metrics for one Academic Year. Pure reads, batched inside a single
   * tenant transaction. Percentages are best-available proxies (attendance is scoped by the year's
   * date window; report-card/timetable completion by the year's enrolled sections/students).
   */
  metrics(year: AcademicYear): Promise<AcademicYearMetrics> {
    const yearId = year.id;
    return this.run(async (tx) => {
      // Year-anchored enrollments grouped by participation status.
      const enrollments = await tx.enrollment.groupBy({
        by: ['status'],
        where: { academicYearId: yearId },
        _count: { _all: true },
      });
      const byStatus = new Map(enrollments.map((e) => [e.status, e._count._all]));
      const countFor = (...ss: EnrollmentStatus[]) =>
        ss.reduce((n, s) => n + (byStatus.get(s) ?? 0), 0);
      const studentCount = enrollments.reduce(
        (n, e) => (e.status === EnrollmentStatus.CANCELLED ? n : n + e._count._all),
        0,
      );

      // Distinct sections + grades actually used by this year's enrolments.
      const [sectionRows, gradeRows, semesterCount] = await Promise.all([
        tx.enrollment.findMany({
          where: { academicYearId: yearId, sectionId: { not: null } },
          distinct: ['sectionId'],
          select: { sectionId: true },
        }),
        tx.enrollment.findMany({
          where: { academicYearId: yearId },
          distinct: ['gradeId'],
          select: { gradeId: true },
        }),
        tx.semester.count({ where: { academicYearId: yearId } }),
      ]);
      const sectionIds = sectionRows.map((r) => r.sectionId).filter((v): v is string => v !== null);

      // Finance: outstanding balance + payments awaiting verification (tenant-wide proxy).
      const [outstanding, unverifiedPayments] = await Promise.all([
        tx.charge.aggregate({
          _sum: { amount: true },
          where: {
            academicYearId: yearId,
            status: { in: [ChargeStatus.PENDING, ChargeStatus.PARTIAL] },
          },
        }),
        tx.payment.count({ where: { status: PaymentStatus.PENDING } }),
      ]);

      // Attendance % over the year's date window (present/late among recorded marks).
      const [attendanceTotal, attendancePresent] = await Promise.all([
        tx.studentAttendance.count({
          where: { date: { gte: year.startDate, lte: year.endDate } },
        }),
        tx.studentAttendance.count({
          where: {
            date: { gte: year.startDate, lte: year.endDate },
            status: { in: [AttendanceStatus.PRESENT, AttendanceStatus.LATE] },
          },
        }),
      ]);

      // Report-card progress: share of active enrolments that have >=1 grade record this year.
      const semesterRows = await tx.semester.findMany({
        where: { academicYearId: yearId },
        select: { id: true },
      });
      const semesterIds = semesterRows.map((s) => s.id);
      const activeEnrollments = countFor(EnrollmentStatus.ACTIVE);
      let reportCardCompletionPct: number | null = null;
      if (activeEnrollments > 0 && semesterIds.length > 0) {
        const graded = await tx.gradeRecord.findMany({
          where: { semesterId: { in: semesterIds } },
          distinct: ['studentId'],
          select: { studentId: true },
        });
        reportCardCompletionPct = Math.min(
          100,
          Math.round((graded.length / activeEnrollments) * 100),
        );
      }

      // Timetable progress: share of the year's sections whose section timetable has >=1 class.
      let timetableCompletionPct: number | null = null;
      if (sectionIds.length > 0) {
        const scheduled = await tx.sectionTimetable.findMany({
          where: { sectionId: { in: sectionIds }, classes: { some: {} } },
          distinct: ['sectionId'],
          select: { sectionId: true },
        });
        timetableCompletionPct = Math.round((scheduled.length / sectionIds.length) * 100);
      }

      return {
        studentCount,
        activeEnrollments,
        graduatingStudents: countFor(EnrollmentStatus.GRADUATED),
        withdrawnStudents: countFor(EnrollmentStatus.WITHDRAWN),
        classCount: sectionIds.length,
        gradeCount: gradeRows.length,
        semesterCount,
        outstandingFees: (outstanding._sum.amount ?? 0).toString(),
        unverifiedPayments,
        attendancePct:
          attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : null,
        reportCardCompletionPct,
        timetableCompletionPct,
      };
    });
  }

  /** Setup-completeness signals for the activation validator + readiness score (all real data). */
  setup(year: AcademicYear): Promise<AcademicYearSetup> {
    return this.run(async (tx) => {
      const [semesters, gradeCount, sectionCount] = await Promise.all([
        tx.semester.findMany({
          where: { academicYearId: year.id },
          select: { startDate: true, endDate: true },
          orderBy: { startDate: 'asc' },
        }),
        tx.grade.count({ where: { campusId: year.campusId } }),
        tx.section.count({ where: { grade: { campusId: year.campusId } } }),
      ]);
      return { semesters, gradeCount, sectionCount };
    });
  }

  /** Existence counts across the year-anchored tables that make a year historically non-deletable. */
  usage(year: AcademicYear): Promise<AcademicYearUsage> {
    return this.run(async (tx) => {
      const semesterRows = await tx.semester.findMany({
        where: { academicYearId: year.id },
        select: { id: true },
      });
      const semesterIds = semesterRows.map((s) => s.id);
      const sectionRows = await tx.enrollment.findMany({
        where: { academicYearId: year.id, sectionId: { not: null } },
        distinct: ['sectionId'],
        select: { sectionId: true },
      });
      const sectionIds = sectionRows.map((r) => r.sectionId).filter((v): v is string => v !== null);

      const [enrollments, charges, reports, timetable, auditLogs] = await Promise.all([
        tx.enrollment.count({ where: { academicYearId: year.id } }),
        tx.charge.count({ where: { academicYearId: year.id } }),
        semesterIds.length > 0
          ? tx.gradeRecord.count({ where: { semesterId: { in: semesterIds } } })
          : Promise.resolve(0),
        sectionIds.length > 0
          ? tx.scheduledClass.count({
              where: { sectionTimetable: { sectionId: { in: sectionIds } } },
            })
          : Promise.resolve(0),
        tx.auditLog.count({ where: { entityType: 'AcademicYear', entityId: year.id } }),
      ]);

      return { enrollments, charges, semesters: semesterIds.length, reports, timetable, auditLogs };
    });
  }
}

import { Injectable } from '@nestjs/common';
import { EnrollmentStatus } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import type { TxClient } from '../../prisma/tenant.helpers';
import { deriveStudentStatus, type EnrollmentStatusView } from './enrollment-lifecycle.logic';

/** Data access for the participation lifecycle: current-enrollment projection + status transitions. */
@Injectable()
export class EnrollmentLifecycleRepository extends TenantRepository {
  /** The student's enrollment in the school's ACTIVE academic year, with its year-scoped placement. */
  currentEnrollment(studentId: string) {
    return this.run((tx) =>
      tx.enrollment.findFirst({
        where: { studentId, academicYear: { status: 'ACTIVE' } },
        include: {
          academicYear: { select: { id: true, name: true, status: true } },
          grade: { select: { id: true, nameEn: true, nameAr: true } },
          section: { select: { id: true, name: true } },
          campus: { select: { id: true, nameEn: true, nameAr: true } },
          classroom: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  /** Minimal per-enrollment view used to derive the student's status shim. */
  private statusViews(tx: TxClient, studentId: string) {
    return tx.enrollment.findMany({
      where: { studentId },
      select: { status: true, academicYear: { select: { status: true, startDate: true } } },
    });
  }

  findEnrollment(enrollmentId: string) {
    return this.run((tx) =>
      tx.enrollment.findFirst({
        where: { id: enrollmentId },
        select: { id: true, studentId: true, status: true },
      }),
    );
  }

  /**
   * Apply a validated participation transition in ONE transaction: update the enrollment (status +
   * terminal date + reason), recompute the DEPRECATED Student.status shim from the student's
   * enrollments, and write an audit row. History is never overwritten — a new status + date is set on
   * THIS enrollment only (Decision 12); promotion/repeat create a separate enrollment elsewhere.
   */
  applyTransition(
    enrollmentId: string,
    studentId: string,
    to: EnrollmentStatus,
    opts: { reason?: string; withdrawalDate?: Date; graduationDate?: Date },
  ) {
    return this.run(async (tx, tenantId) => {
      const enrollment = await tx.enrollment.update({
        where: { id: enrollmentId },
        data: {
          status: to,
          ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
          ...(opts.withdrawalDate ? { withdrawalDate: opts.withdrawalDate } : {}),
          ...(opts.graduationDate ? { graduationDate: opts.graduationDate } : {}),
          // Reactivation (→ ACTIVE) clears the terminal withdrawal/graduation dates so the enrollment
          // reads as a live, participating record again.
          ...(to === EnrollmentStatus.ACTIVE ? { withdrawalDate: null, graduationDate: null } : {}),
        },
      });

      // Recompute + write the Student.status shim (read-through cache; never authoritative).
      const rows = await this.statusViews(tx, studentId);
      const derived = deriveStudentStatus(
        rows.map(
          (r): EnrollmentStatusView => ({
            status: r.status,
            academicYearStatus: r.academicYear.status,
            academicYearStart: r.academicYear.startDate,
          }),
        ),
      );
      if (derived !== null) {
        await tx.student.update({ where: { id: studentId }, data: { status: derived } });
      }

      await this.writeAudit(tx, tenantId, {
        action: 'enrollment.transition',
        entityType: 'Enrollment',
        entityId: enrollmentId,
        metadata: { to, ...(opts.reason ? { reason: opts.reason } : {}) },
      });
      return enrollment;
    });
  }

  /** All enrollments' status views for a student (for the derived-status projection). */
  studentStatusViews(studentId: string): Promise<EnrollmentStatusView[]> {
    return this.run(async (tx) => {
      const rows = await this.statusViews(tx, studentId);
      return rows.map((r) => ({
        status: r.status,
        academicYearStatus: r.academicYear.status,
        academicYearStart: r.academicYear.startDate,
      }));
    });
  }
}

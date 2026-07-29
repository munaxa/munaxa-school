import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EnrollmentStatus, StudentStatus } from '@prisma/client';
import { EnrollmentLifecycleRepository } from './enrollment-lifecycle.repository';
import { canTransition, deriveStudentStatus } from './enrollment-lifecycle.logic';

/**
 * The SOLE writer of participation-lifecycle (EnrollmentStatus) transitions and the SOLE place that
 * derives the student's "current status" (Decisions 2, 4, 7, 13). Year-End Processing (promote/repeat/
 * graduate) and Withdrawal call `transition`; the derived projection powers the student profile.
 * Academic placement is year-scoped on the Enrollment — never authoritative on Student.
 */
@Injectable()
export class EnrollmentLifecycleService {
  constructor(private readonly repo: EnrollmentLifecycleRepository) {}

  /** The student's current-year enrollment (active academic year) with its placement, or null. */
  currentEnrollment(studentId: string) {
    return this.repo.currentEnrollment(studentId);
  }

  /**
   * DERIVED current status of the student, computed from their enrollments (never stored
   * authoritatively). Returns ACTIVE for a student with no enrollments yet (a bare identity record).
   */
  async currentStatus(studentId: string): Promise<StudentStatus> {
    const views = await this.repo.studentStatusViews(studentId);
    return deriveStudentStatus(views) ?? StudentStatus.ACTIVE;
  }

  /**
   * Move an enrollment to a new participation status (with an optional reason + effective date). Guards
   * the transition against the allowed state machine and stamps the withdrawal/graduation date. Never
   * mutates any other (historical) enrollment.
   */
  async transition(
    enrollmentId: string,
    to: EnrollmentStatus,
    opts: { reason?: string; effectiveDate?: Date } = {},
  ) {
    const enrollment = await this.repo.findEnrollment(enrollmentId);
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (enrollment.status === to) return this.repo.findEnrollment(enrollmentId);
    if (!canTransition(enrollment.status, to)) {
      throw new BadRequestException(`Illegal enrollment transition ${enrollment.status} → ${to}`);
    }
    const when = opts.effectiveDate ?? new Date();
    return this.repo.applyTransition(enrollmentId, enrollment.studentId, to, {
      ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
      ...(to === EnrollmentStatus.WITHDRAWN ? { withdrawalDate: when } : {}),
      ...(to === EnrollmentStatus.GRADUATED ? { graduationDate: when } : {}),
    });
  }
}

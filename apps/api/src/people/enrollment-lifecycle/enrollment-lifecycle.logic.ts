import { AcademicYearStatus, EnrollmentStatus, StudentStatus } from '@prisma/client';

/**
 * Pure participation-lifecycle logic (Decisions 2, 4, 7, 13). No I/O — the single place that defines
 * (a) which EnrollmentStatus transitions are legal and (b) how the DEPRECATED `Student.status` shim is
 * DERIVED from a student's enrollments. `Student` never stores academic status authoritatively; the
 * shim is a read-through cache written only by EnrollmentLifecycleService for backward compatibility.
 */

/** Legal participation transitions. Terminal states (WITHDRAWN/GRADUATED/ARCHIVED) do not move on. */
export const ALLOWED_TRANSITIONS: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  ACTIVE: [
    EnrollmentStatus.COMPLETED,
    EnrollmentStatus.WITHDRAWN,
    EnrollmentStatus.GRADUATED,
    EnrollmentStatus.ARCHIVED,
  ],
  COMPLETED: [
    EnrollmentStatus.PROMOTED,
    EnrollmentStatus.REPEATED,
    EnrollmentStatus.GRADUATED,
    EnrollmentStatus.ARCHIVED,
  ],
  PROMOTED: [EnrollmentStatus.ARCHIVED],
  REPEATED: [EnrollmentStatus.ARCHIVED],
  // A withdrawal can be reversed (reactivation) back to ACTIVE — an operational correction that
  // re-instates participation for the same year; the financial settlement is reversed separately.
  WITHDRAWN: [EnrollmentStatus.ACTIVE, EnrollmentStatus.ARCHIVED],
  GRADUATED: [EnrollmentStatus.ARCHIVED],
  ARCHIVED: [],
  // Legacy admission-workflow values (transition only): allow them to become ACTIVE or be archived.
  QUOTED: [EnrollmentStatus.ACTIVE, EnrollmentStatus.ARCHIVED],
  PENDING_APPROVAL: [EnrollmentStatus.ACTIVE, EnrollmentStatus.ARCHIVED],
  COMMITTED: [EnrollmentStatus.ACTIVE, EnrollmentStatus.ARCHIVED],
  CANCELLED: [EnrollmentStatus.ARCHIVED],
};

export function canTransition(from: EnrollmentStatus, to: EnrollmentStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** A minimal view of one enrollment needed to derive the student's current status. */
export interface EnrollmentStatusView {
  status: EnrollmentStatus;
  academicYearStatus: AcademicYearStatus;
  /** Academic year start date — used to pick the "latest" enrollment when none is in the active year. */
  academicYearStart: Date;
}

/** Map a single participation status to the derived Student record-status shim. */
function toStudentStatus(status: EnrollmentStatus): StudentStatus {
  switch (status) {
    case EnrollmentStatus.ACTIVE:
      return StudentStatus.ACTIVE;
    case EnrollmentStatus.GRADUATED:
      return StudentStatus.GRADUATED;
    case EnrollmentStatus.WITHDRAWN:
      return StudentStatus.WITHDRAWN;
    default:
      // COMPLETED/PROMOTED/REPEATED/ARCHIVED (and legacy values) → no current active participation.
      return StudentStatus.INACTIVE;
  }
}

/**
 * Derive the (shim) Student.status from all of a student's enrollments:
 *   1. If they have an enrollment in the school's ACTIVE academic year, that drives the status.
 *   2. Otherwise the most recent enrollment (by academic-year start) drives it — so a graduated or
 *      withdrawn alumnus reads correctly.
 * Returns null when the student has no enrollments at all (leave the existing value untouched — the
 * Student is a permanent identity record and is never archived by this derivation, per Decision 7).
 */
export function deriveStudentStatus(enrollments: EnrollmentStatusView[]): StudentStatus | null {
  if (enrollments.length === 0) return null;
  const active = enrollments.find((e) => e.academicYearStatus === AcademicYearStatus.ACTIVE);
  if (active) return toStudentStatus(active.status);
  const latest = [...enrollments].sort(
    (a, b) => b.academicYearStart.getTime() - a.academicYearStart.getTime(),
  )[0]!;
  return toStudentStatus(latest.status);
}

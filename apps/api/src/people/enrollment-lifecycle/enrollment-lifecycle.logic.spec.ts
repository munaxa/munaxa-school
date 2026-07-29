import { AcademicYearStatus, EnrollmentStatus, StudentStatus } from '@prisma/client';
import {
  canTransition,
  deriveStudentStatus,
  type EnrollmentStatusView,
} from './enrollment-lifecycle.logic';

const view = (
  status: EnrollmentStatus,
  academicYearStatus: AcademicYearStatus,
  start: string,
): EnrollmentStatusView => ({
  status,
  academicYearStatus,
  academicYearStart: new Date(start),
});

describe('enrollment-lifecycle logic — transitions (Decision 2)', () => {
  it('allows the year-end and terminal transitions from ACTIVE', () => {
    expect(canTransition(EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED)).toBe(true);
    expect(canTransition(EnrollmentStatus.ACTIVE, EnrollmentStatus.WITHDRAWN)).toBe(true);
    expect(canTransition(EnrollmentStatus.ACTIVE, EnrollmentStatus.GRADUATED)).toBe(true);
  });

  it('allows promotion/repetition only from COMPLETED', () => {
    expect(canTransition(EnrollmentStatus.COMPLETED, EnrollmentStatus.PROMOTED)).toBe(true);
    expect(canTransition(EnrollmentStatus.ACTIVE, EnrollmentStatus.PROMOTED)).toBe(false);
  });

  it('treats GRADUATED/ARCHIVED as terminal, but allows WITHDRAWN → ACTIVE (reactivation)', () => {
    expect(canTransition(EnrollmentStatus.GRADUATED, EnrollmentStatus.ACTIVE)).toBe(false);
    expect(canTransition(EnrollmentStatus.ARCHIVED, EnrollmentStatus.ACTIVE)).toBe(false);
    // A withdrawal is reversible — reactivation restores participation for the same year.
    expect(canTransition(EnrollmentStatus.WITHDRAWN, EnrollmentStatus.ACTIVE)).toBe(true);
    expect(canTransition(EnrollmentStatus.WITHDRAWN, EnrollmentStatus.ARCHIVED)).toBe(true);
  });
});

describe('enrollment-lifecycle logic — derived Student status (Decisions 4, 7, 13)', () => {
  it('returns null for a student with no enrollments (identity untouched)', () => {
    expect(deriveStudentStatus([])).toBeNull();
  });

  it('drives status from the enrollment in the ACTIVE academic year', () => {
    const s = deriveStudentStatus([
      view(EnrollmentStatus.GRADUATED, AcademicYearStatus.CLOSED, '2024-09-01'),
      view(EnrollmentStatus.ACTIVE, AcademicYearStatus.ACTIVE, '2026-09-01'),
    ]);
    expect(s).toBe(StudentStatus.ACTIVE);
  });

  it('falls back to the most recent enrollment when none is in the active year', () => {
    const s = deriveStudentStatus([
      view(EnrollmentStatus.COMPLETED, AcademicYearStatus.CLOSED, '2023-09-01'),
      view(EnrollmentStatus.GRADUATED, AcademicYearStatus.CLOSED, '2025-09-01'),
    ]);
    expect(s).toBe(StudentStatus.GRADUATED);
  });

  it('maps a withdrawn active-year enrollment to WITHDRAWN', () => {
    const s = deriveStudentStatus([
      view(EnrollmentStatus.WITHDRAWN, AcademicYearStatus.ACTIVE, '2026-09-01'),
    ]);
    expect(s).toBe(StudentStatus.WITHDRAWN);
  });

  it('maps a completed/promoted (no active participation) student to INACTIVE', () => {
    const s = deriveStudentStatus([
      view(EnrollmentStatus.PROMOTED, AcademicYearStatus.CLOSED, '2025-09-01'),
    ]);
    expect(s).toBe(StudentStatus.INACTIVE);
  });
});

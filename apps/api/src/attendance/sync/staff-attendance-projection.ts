/**
 * HR → Academics attendance projection (Attendance evolution program, PR-5).
 *
 * Pure mapping from an HR `StaffAttendanceStatus` (7 values) to the Academic
 * `TeacherAttendanceStatus` (4 values). Kept side-effect-free and free of Nest/Prisma runtime
 * imports so it is unit-testable and so the two bounded contexts stay decoupled: HR publishes a
 * fact, Academics decides what that fact means for teaching presence.
 *
 * Ownership: Academics owns every write to `TeacherAttendance` (see CAPABILITY_OWNERSHIP_MATRIX C5).
 * HR never writes to it — it only emits `StaffAttendanceRecorded`.
 */
import type { StaffAttendanceStatus, TeacherAttendanceStatus } from '@prisma/client';

/**
 * Map an HR staff status onto teaching presence.
 *
 * - `PRESENT` / `REMOTE` / `EARLY_DEPARTURE` ⇒ the teacher was at work ⇒ `PRESENT`.
 *   (Remote counts as present for *teaching availability*; payroll treats it separately.)
 * - `LATE` ⇒ `LATE` (they taught, but arrival matters to the academic record).
 * - `ABSENT` ⇒ `ABSENT`.
 * - `ON_LEAVE` ⇒ `ON_LEAVE`.
 * - `HOLIDAY` ⇒ `null`: a non-working day produces **no** teacher-attendance row at all, rather
 *   than a misleading PRESENT/ABSENT. Callers must skip projection when this returns null.
 */
export function projectStaffStatusToTeacherStatus(
  status: StaffAttendanceStatus,
): TeacherAttendanceStatus | null {
  switch (status) {
    case 'PRESENT':
    case 'REMOTE':
    case 'EARLY_DEPARTURE':
      return 'PRESENT';
    case 'LATE':
      return 'LATE';
    case 'ABSENT':
      return 'ABSENT';
    case 'ON_LEAVE':
      return 'ON_LEAVE';
    case 'HOLIDAY':
      return null;
    default: {
      // Exhaustiveness guard: a new StaffAttendanceStatus must be mapped explicitly rather than
      // silently projected. Unknown values produce no projection.
      return null;
    }
  }
}

/** Whether a projected teacher status means the teacher cannot take their classes that day. */
export function blocksTeaching(status: TeacherAttendanceStatus): boolean {
  return status === 'ABSENT' || status === 'ON_LEAVE';
}

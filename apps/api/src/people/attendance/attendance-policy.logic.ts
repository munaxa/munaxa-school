/**
 * Attendance Policy engine (Attendance evolution program, capability N2).
 *
 * Pure, data-driven interpretation of a day's raw attendance measurements against a school's
 * configurable thresholds. Kept side-effect-free and dependency-light (only the Prisma status enum
 * as a type) so it is unit-testable and reusable by the write path (status derivation), payroll, and
 * analytics — one policy, one interpretation, never forked.
 *
 * Separation of concerns: the *shift engine* (N1) turns check-in/out stamps into raw minutes
 * (lateness, worked, shortfall, early-departure, overtime). This module turns those raw minutes into
 * a status + payable day-fraction using policy thresholds. Thresholds live in data (an
 * AttendancePolicy row); this module holds only the arithmetic and a safe default.
 */
import type { StaffAttendanceStatus } from '@prisma/client';

/** Statuses this engine may *derive* (others — ON_LEAVE/HOLIDAY/REMOTE — are set by their own flows). */
export type DerivedAttendanceStatus = Extract<
  StaffAttendanceStatus,
  'PRESENT' | 'LATE' | 'EARLY_DEPARTURE' | 'ABSENT'
>;

/** A school's configurable attendance thresholds. All values are data-driven — nothing hardcoded. */
export interface AttendancePolicyConfig {
  /** Minutes of lateness forgiven before any lateness is recorded. */
  graceMinutes: number;
  /** Effective lateness (after grace) at or beyond this many minutes marks the day LATE. */
  lateAfterMinutes: number;
  /** Effective lateness at or beyond this, or no check-in, marks the day ABSENT. */
  absentAfterMinutes: number;
  /** Worked-time shortfall (expected − worked) at or beyond this many minutes makes it a half day. */
  halfDayAfterShortfallMinutes: number;
  /** Leaving early by at least this many minutes marks EARLY_DEPARTURE. */
  earlyDepartureAfterMinutes: number;
  /** Overtime is credited only once worked-beyond-expected reaches this many minutes. */
  overtimeAfterMinutes: number;
  /** Whether weekend days count as working days under this policy. */
  countWeekendAsWorking: boolean;
  /** Whether a manual status override is permitted (still subject to permission checks). */
  allowManualOverride: boolean;
}

/**
 * The system default policy. Chosen to be conservative and to preserve today's behaviour where no
 * policy is configured: lateness is only credited beyond a small grace, a day is absent only when
 * there is effectively no attendance, and overtime needs a meaningful margin. A tenant overrides any
 * field via its AttendancePolicy row.
 */
export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicyConfig = {
  graceMinutes: 5,
  lateAfterMinutes: 1,
  absentAfterMinutes: 240,
  halfDayAfterShortfallMinutes: 180,
  earlyDepartureAfterMinutes: 15,
  overtimeAfterMinutes: 30,
  countWeekendAsWorking: false,
  allowManualOverride: true,
};

/** Raw, shift-derived measurements for a single employee-day (all minutes, all ≥ 0). */
export interface AttendanceMeasurement {
  /** Did the employee check in at all? */
  checkedIn: boolean;
  /** Minutes the check-in was after the expected start (0 if on-time/early). */
  lateMinutes: number;
  /** Minutes the check-out was before the expected end (0 if none). */
  earlyDepartureMinutes: number;
  /** Expected working minutes for the shift/day. */
  expectedMinutes: number;
  /** Actual worked minutes. */
  workedMinutes: number;
}

/** The policy engine's verdict for a day. */
export interface AttendanceEvaluation {
  status: DerivedAttendanceStatus;
  /** Lateness counted after grace (0 when within grace). */
  effectiveLateMinutes: number;
  /** Early-departure minutes echoed when they exceed the policy threshold, else 0. */
  earlyDepartureMinutes: number;
  /** Overtime minutes credited under the policy (0 until the threshold is reached). */
  overtimeMinutes: number;
  /** Payable fraction of the day: 1 (full), 0.5 (half), or 0 (absent). */
  dayFraction: 1 | 0.5 | 0;
}

const clampNonNegative = (n: number): number => (n > 0 ? n : 0);

/**
 * Evaluate one employee-day against a policy. Precedence: absence dominates (no attendance or
 * lateness past the absent threshold → ABSENT, fraction 0). Otherwise the day is payable (full, or
 * half when the worked shortfall crosses the half-day threshold), and the status reflects lateness
 * first, then early departure, else present.
 */
export function evaluateAttendance(
  measurement: AttendanceMeasurement,
  policy: AttendancePolicyConfig = DEFAULT_ATTENDANCE_POLICY,
): AttendanceEvaluation {
  const effectiveLateMinutes = clampNonNegative(measurement.lateMinutes - policy.graceMinutes);

  // Absence dominates every other classification.
  if (!measurement.checkedIn || effectiveLateMinutes >= policy.absentAfterMinutes) {
    return {
      status: 'ABSENT',
      effectiveLateMinutes: measurement.checkedIn ? effectiveLateMinutes : 0,
      earlyDepartureMinutes: 0,
      overtimeMinutes: 0,
      dayFraction: 0,
    };
  }

  const shortfall = clampNonNegative(measurement.expectedMinutes - measurement.workedMinutes);
  const dayFraction: 1 | 0.5 = shortfall >= policy.halfDayAfterShortfallMinutes ? 0.5 : 1;

  const rawOvertime = clampNonNegative(measurement.workedMinutes - measurement.expectedMinutes);
  const overtimeMinutes = rawOvertime >= policy.overtimeAfterMinutes ? rawOvertime : 0;

  const isLate = effectiveLateMinutes >= policy.lateAfterMinutes;
  const isEarlyDeparture = measurement.earlyDepartureMinutes >= policy.earlyDepartureAfterMinutes;

  const status: DerivedAttendanceStatus = isLate
    ? 'LATE'
    : isEarlyDeparture
      ? 'EARLY_DEPARTURE'
      : 'PRESENT';

  return {
    status,
    effectiveLateMinutes,
    earlyDepartureMinutes: isEarlyDeparture ? measurement.earlyDepartureMinutes : 0,
    overtimeMinutes,
    dayFraction,
  };
}

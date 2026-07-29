/**
 * Teacher availability resolution (Attendance evolution program, PR-6).
 *
 * Pure fold of facts that already exist in other aggregates — teacher attendance (C5), schedule
 * exceptions/substitutions (C3) and staff leave (C8) — into a single answer to "can this teacher
 * take their classes today?".
 *
 * This is a **read model**: it owns no table and performs no writes. Substitution is *not*
 * re-implemented here; it is read from the existing `ScheduleException(SUBSTITUTION)` rows that the
 * scheduling engine already resolves (Rule 4: never fork existing logic).
 */
import type { TeacherAttendanceStatus } from '@prisma/client';

/** Why a teacher is (un)available. Ordered by precedence in {@link resolveTeacherAvailability}. */
export type TeacherAvailabilityState =
  | 'CAN_TEACH'
  | 'SUBSTITUTED'
  | 'ON_LEAVE'
  | 'TRAINING'
  | 'MEETING'
  | 'EMERGENCY'
  | 'UNAVAILABLE';

/** Inputs, each sourced from its canonical owner. All are optional facts about one teacher-day. */
export interface TeacherAvailabilityInput {
  /** Today's TeacherAttendance status, when a record exists (Academics). */
  attendanceStatus?: TeacherAttendanceStatus | null;
  /** An approved staff-leave span covers this date (HR leave). */
  onApprovedLeave?: boolean;
  /** A SUBSTITUTION schedule exception names a substitute for this teacher today (Scheduling). */
  hasSubstitution?: boolean;
  /** The teacher is booked on a training course today (HR training). */
  onTraining?: boolean;
  /** The teacher is booked in a meeting today. */
  inMeeting?: boolean;
  /** An emergency closure/absence overrides everything else. */
  emergency?: boolean;
}

export interface TeacherAvailability {
  state: TeacherAvailabilityState;
  /** True only when the teacher can actually take their scheduled classes. */
  canTeach: boolean;
  /** Human-readable reason key (i18n-able); null when fully available. */
  reason: string | null;
}

/**
 * Resolve availability with an explicit, testable precedence:
 *
 * 1. `emergency`      — overrides everything.
 * 2. `onApprovedLeave` / attendance `ON_LEAVE` — contractually away.
 * 3. `hasSubstitution` — someone else is already covering the class.
 * 4. attendance `ABSENT` — away without a substitute assigned yet.
 * 5. `onTraining` / `inMeeting` — present at work but not teaching.
 * 6. otherwise available (including `LATE`, which still teaches).
 *
 * A missing attendance record is *not* treated as absence: nothing has been marked yet, so the
 * teacher is presumed available (fail-open for scheduling, fail-closed is handled by attendance).
 */
export function resolveTeacherAvailability(input: TeacherAvailabilityInput): TeacherAvailability {
  if (input.emergency) {
    return { state: 'EMERGENCY', canTeach: false, reason: 'availability.emergency' };
  }
  if (input.onApprovedLeave || input.attendanceStatus === 'ON_LEAVE') {
    return { state: 'ON_LEAVE', canTeach: false, reason: 'availability.onLeave' };
  }
  if (input.hasSubstitution) {
    return { state: 'SUBSTITUTED', canTeach: false, reason: 'availability.substituted' };
  }
  if (input.attendanceStatus === 'ABSENT') {
    return { state: 'UNAVAILABLE', canTeach: false, reason: 'availability.absent' };
  }
  if (input.onTraining) {
    return { state: 'TRAINING', canTeach: false, reason: 'availability.training' };
  }
  if (input.inMeeting) {
    return { state: 'MEETING', canTeach: false, reason: 'availability.meeting' };
  }
  return { state: 'CAN_TEACH', canTeach: true, reason: null };
}

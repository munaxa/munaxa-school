/**
 * Shift-window engine (Attendance evolution program, capability N1).
 *
 * Pure arithmetic that turns a configured shift window + check-in/out stamps into the raw
 * {@link AttendanceMeasurement} the policy engine (N2) interprets. Side-effect-free and unit-testable.
 * The `HH:MM` → minutes conversion reuses the canonical `timeToMinutes` from the Scheduling engine
 * (C3) — no duplicate time parser (Rule 4).
 *
 * Scope: same-day shifts. Stamps are compared by wall-clock minute-of-day in a single reference
 * frame (UTC here), matching how the timetable resolver reads times; timezone normalisation of the
 * stamps is the caller's responsibility. Overnight shifts are a documented future extension.
 */
import { timeToMinutes } from '../../scheduling/engine/scheduling-engine';
import type { AttendanceMeasurement } from './attendance-policy.logic';

/** A configured shift's expectations. Times are `HH:MM` (24h); breaks/caps are minutes/hours. */
export interface ShiftWindow {
  /** Expected check-in time, `HH:MM`. */
  expectedCheckIn: string;
  /** Expected check-out time, `HH:MM` (later than check-in — same day). */
  expectedCheckOut: string;
  /** Unpaid break minutes deducted from both expected and worked time. */
  breakMinutes: number;
  /** Optional hard cap on credited worked hours (guards runaway/forgotten check-outs). */
  maxHours?: number | null;
}

/** The check-in / check-out stamps for a day (either may be missing). */
export interface ShiftPunches {
  checkInAt: Date | null;
  checkOutAt: Date | null;
}

/** Minute-of-day (0–1439) of a timestamp, in UTC wall-clock. */
export function minutesOfDay(at: Date): number {
  return at.getUTCHours() * 60 + at.getUTCMinutes();
}

/** Expected working minutes for a shift = gross window minus the unpaid break (never negative). */
export function expectedShiftMinutes(window: ShiftWindow): number {
  const gross = timeToMinutes(window.expectedCheckOut) - timeToMinutes(window.expectedCheckIn);
  return Math.max(0, gross - window.breakMinutes);
}

/**
 * Measure a day against a shift window. With no check-in the day is "not checked in" (0 worked). A
 * check-in without a check-out yields 0 worked minutes (an incomplete day) — the policy engine then
 * decides how to treat it. `maxHours` caps credited worked minutes when provided.
 */
export function measureShift(window: ShiftWindow, punches: ShiftPunches): AttendanceMeasurement {
  const expectedMinutes = expectedShiftMinutes(window);

  if (!punches.checkInAt) {
    return {
      checkedIn: false,
      lateMinutes: 0,
      earlyDepartureMinutes: 0,
      expectedMinutes,
      workedMinutes: 0,
    };
  }

  const expectedInMinutes = timeToMinutes(window.expectedCheckIn);
  const expectedOutMinutes = timeToMinutes(window.expectedCheckOut);
  const actualInMinutes = minutesOfDay(punches.checkInAt);
  const lateMinutes = Math.max(0, actualInMinutes - expectedInMinutes);

  let earlyDepartureMinutes = 0;
  let workedMinutes = 0;
  if (punches.checkOutAt) {
    const actualOutMinutes = minutesOfDay(punches.checkOutAt);
    earlyDepartureMinutes = Math.max(0, expectedOutMinutes - actualOutMinutes);
    const gross = Math.max(0, actualOutMinutes - actualInMinutes);
    workedMinutes = Math.max(0, gross - window.breakMinutes);
    if (window.maxHours != null) {
      workedMinutes = Math.min(workedMinutes, window.maxHours * 60);
    }
  }

  return { checkedIn: true, lateMinutes, earlyDepartureMinutes, expectedMinutes, workedMinutes };
}

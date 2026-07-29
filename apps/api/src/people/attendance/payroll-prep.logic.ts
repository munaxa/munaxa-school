/**
 * Payroll-preparation aggregation (HR Phase 5).
 *
 * Pure, dependency-free helpers that turn raw staff-attendance rows and approved-leave coverage
 * into a per-employee payroll-prep summary for a date range. Kept side-effect-free so it is
 * unit-testable and never touches the database. Money is intentionally NOT computed here — this is
 * *preparation*: it produces payable/absent/overtime day counts a payroll officer exports and feeds
 * into the actual payroll run.
 *
 * The working week excludes the Fri/Sat weekend (see {@link workingDaysBetween}).
 */
import { StaffAttendanceStatus } from '@prisma/client';
import { workingDaysBetween, type WorkingDayCalendar } from '../leave/leave-days.logic';

export interface AttendanceDayInput {
  status: StaffAttendanceStatus;
  lateMinutes: number | null;
  overtimeHours: number | null;
}

/** Working-days coverage of approved leave inside the range, split by payroll treatment. */
export interface LeaveAllocation {
  paidLeaveDays: number;
  unpaidLeaveDays: number;
}

export interface PayrollPrepSummary {
  workingDays: number;
  presentDays: number;
  remoteDays: number;
  absentDays: number;
  lateDays: number;
  lateMinutes: number;
  overtimeHours: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  /** Working days payable at full rate: workingDays − absent − unpaid leave (clamped at 0). */
  payableDays: number;
}

/** Round to 2 decimals, avoiding binary-float drift on summed overtime hours. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Working days in the intersection of an approved-leave span and the reporting range. Both ends are
 * inclusive; a span entirely outside the range contributes 0.
 */
export function overlapWorkingDays(
  rangeStart: Date,
  rangeEnd: Date,
  leaveStart: Date,
  leaveEnd: Date,
  calendar?: WorkingDayCalendar,
): number {
  const from = leaveStart > rangeStart ? leaveStart : rangeStart;
  const to = leaveEnd < rangeEnd ? leaveEnd : rangeEnd;
  return workingDaysBetween(from, to, calendar);
}

/**
 * Summarise one employee's attendance for a range. `workingDays` is the weekend-excluded span;
 * `days` are the recorded attendance rows within it; `leave` is the approved-leave coverage.
 */
export function summarizeAttendance(
  workingDays: number,
  days: AttendanceDayInput[],
  leave: LeaveAllocation,
): PayrollPrepSummary {
  let presentDays = 0;
  let remoteDays = 0;
  let absentDays = 0;
  let lateDays = 0;
  let lateMinutes = 0;
  let overtimeHours = 0;

  for (const day of days) {
    switch (day.status) {
      case StaffAttendanceStatus.PRESENT:
      case StaffAttendanceStatus.LATE:
      case StaffAttendanceStatus.EARLY_DEPARTURE:
        presentDays += 1;
        break;
      case StaffAttendanceStatus.REMOTE:
        remoteDays += 1;
        break;
      case StaffAttendanceStatus.ABSENT:
        absentDays += 1;
        break;
      // ON_LEAVE / HOLIDAY are accounted for via the leave allocation / calendar, not here.
      default:
        break;
    }
    if (day.status === StaffAttendanceStatus.LATE) lateDays += 1;
    lateMinutes += day.lateMinutes ?? 0;
    overtimeHours += day.overtimeHours ?? 0;
  }

  const payableDays = Math.max(0, workingDays - absentDays - leave.unpaidLeaveDays);

  return {
    workingDays,
    presentDays,
    remoteDays,
    absentDays,
    lateDays,
    lateMinutes,
    overtimeHours: round2(overtimeHours),
    paidLeaveDays: leave.paidLeaveDays,
    unpaidLeaveDays: leave.unpaidLeaveDays,
    payableDays,
  };
}

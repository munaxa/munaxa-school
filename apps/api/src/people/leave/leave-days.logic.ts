/**
 * Working-day arithmetic for staff leave (HR Phase 4) — the single canonical helper shared by leave
 * and payroll preparation (see CAPABILITY_OWNERSHIP_MATRIX C8). Kept pure + dependency-free so it is
 * unit-testable and never forked.
 *
 * Baseline rule: a working day is any day that is not the Friday/Saturday weekend (the Jordanian
 * working week). This is now *calendar-aware*: callers may pass an optional {@link WorkingDayCalendar}
 * so public/school holidays and closures are excluded, and exceptional working days (e.g. a make-up
 * day that falls on a weekend) are included. The calendar is injected — the source of truth for which
 * dates are holidays lives in the Scheduling context (C3), never duplicated here. Omitting the
 * calendar preserves the exact original weekend-only behaviour (backward compatible).
 */

/** Day-of-week indices treated as the weekend (Fri = 5, Sat = 6 in JS getUTCDay()). */
const WEEKEND_DAYS = new Set([5, 6]);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A read-only calendar the working-day helper consults. Implementations are provided by the
 * Scheduling context (holidays/closures) — this module owns the *arithmetic*, not the data.
 */
export interface WorkingDayCalendar {
  /** True if the date is a non-working day beyond the weekend (holiday, closure, non-working day). */
  isHoliday(date: Date): boolean;
  /**
   * True if the date is an exceptional working day that overrides the weekend (a special/make-up
   * working day). Optional; when absent, weekends are always non-working.
   */
  isSpecialWorkingDay?(date: Date): boolean;
}

/** Whether a date falls on the (Fri/Sat) weekend. */
export function isWeekend(date: Date): boolean {
  return WEEKEND_DAYS.has(date.getUTCDay());
}

/**
 * Whether a single date is a working day. A special working day overrides the weekend; otherwise a
 * day is working when it is neither a weekend nor a calendar holiday. With no calendar, this is
 * exactly `!isWeekend(date)`.
 */
export function isWorkingDay(date: Date, calendar?: WorkingDayCalendar): boolean {
  if (calendar?.isSpecialWorkingDay?.(date)) return true;
  if (isWeekend(date)) return false;
  if (calendar?.isHoliday(date)) return false;
  return true;
}

/**
 * Count working days between two inclusive dates. Returns 0 when `end` is before `start`. Dates are
 * compared by UTC calendar day, so time components are ignored. When a {@link WorkingDayCalendar} is
 * supplied, holidays are excluded and special working days are included; otherwise only weekends are
 * excluded (original behaviour).
 */
export function workingDaysBetween(start: Date, end: Date, calendar?: WorkingDayCalendar): number {
  const from = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const to = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  if (to < from) return 0;
  let count = 0;
  for (let ms = from; ms <= to; ms += MS_PER_DAY) {
    if (isWorkingDay(new Date(ms), calendar)) count += 1;
  }
  return count;
}

/** Normalise a Date or ISO string to its `YYYY-MM-DD` UTC calendar-day key. */
export function toDayKey(date: Date | string): string {
  return (typeof date === 'string' ? date : date.toISOString()).slice(0, 10);
}

/**
 * Build a {@link WorkingDayCalendar} from explicit sets of `YYYY-MM-DD` dates. This is the shape a
 * Scheduling-backed provider produces after fetching holiday/closure dates for a range, keeping the
 * data-fetch (impure) and the arithmetic (pure) cleanly separated. Both arguments are optional.
 */
export function calendarFromDates(
  holidays: Iterable<string> = [],
  specialWorkingDays: Iterable<string> = [],
): WorkingDayCalendar {
  const holidaySet = new Set(holidays);
  const specialSet = new Set(specialWorkingDays);
  return {
    isHoliday: (date) => holidaySet.has(toDayKey(date)),
    isSpecialWorkingDay: (date) => specialSet.has(toDayKey(date)),
  };
}

/**
 * Attendance lock coverage (Attendance evolution program, capability N3).
 *
 * Pure predicates deciding whether a date falls inside an active immutability window. Kept
 * dependency-free so the rule is unit-testable and identical everywhere it is enforced (the write
 * guard, the correction workflow and payroll validation all call this — never their own copy).
 */

/** The minimum shape a lock must have to be evaluated. Mirrors the AttendanceLock model. */
export interface LockWindow {
  periodStart: Date;
  periodEnd: Date;
  status: 'ACTIVE' | 'RELEASED';
  /** null ⇒ tenant-wide (covers every campus). */
  campusId?: string | null;
}

/** UTC calendar-day value of a date, so time components never affect comparison. */
function dayValue(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Whether a single lock covers a date. Both period bounds are inclusive. A `RELEASED` lock never
 * covers anything. A tenant-wide lock (`campusId: null`) covers every campus; a campus-scoped lock
 * only covers that campus.
 */
export function lockCoversDate(lock: LockWindow, date: Date, campusId?: string | null): boolean {
  if (lock.status !== 'ACTIVE') return false;
  if (lock.campusId != null && lock.campusId !== campusId) return false;
  const d = dayValue(date);
  return d >= dayValue(lock.periodStart) && d <= dayValue(lock.periodEnd);
}

/** The first active lock covering a date, or null when the date is writable. */
export function findCoveringLock<T extends LockWindow>(
  locks: readonly T[],
  date: Date,
  campusId?: string | null,
): T | null {
  return locks.find((lock) => lockCoversDate(lock, date, campusId)) ?? null;
}

/** Whether any active lock covers the date. */
export function isDateLocked(
  locks: readonly LockWindow[],
  date: Date,
  campusId?: string | null,
): boolean {
  return findCoveringLock(locks, date, campusId) !== null;
}

/** Whether a whole range is free of active locks (used by payroll validation). */
export function isRangeUnlocked(
  locks: readonly LockWindow[],
  from: Date,
  to: Date,
  campusId?: string | null,
): boolean {
  const start = dayValue(from);
  const end = dayValue(to);
  return !locks.some((lock) => {
    if (lock.status !== 'ACTIVE') return false;
    if (lock.campusId != null && lock.campusId !== campusId) return false;
    // Overlap test: the lock intersects [from, to].
    return dayValue(lock.periodStart) <= end && dayValue(lock.periodEnd) >= start;
  });
}

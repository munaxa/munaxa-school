/**
 * Munaxa enterprise scheduling engine (pure, framework-free — fully unit-testable).
 *
 * Resolves a SECTION's published schedule for a given day, computes the live "current class" context
 * shared by the Parent/Student/Teacher portals + attendance, and detects the conflicts that must be
 * clear before a SchedulePlan can be published.
 *
 * A timetable belongs to a Section; students/parents/teachers inherit it. Nothing here reads a
 * student — callers resolve the section (via Enrollment / TeacherSection) and pass its classes in.
 *
 * Resolution algorithm (mirrors the legacy engine, now "Class" instead of "Period"):
 *   1. Ramadan mode (per date) selects the REGULAR vs RAMADAN class set.
 *   2. A whole-day HOLIDAY exception ⇒ no classes.
 *   3. Otherwise take the section's classes for (scheduleType, dayOfWeek), sorted by classNumber.
 *   4. Overlay per-class exceptions: cancel / substitute / replace.
 */

export type DayOfWeek = 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
export type ScheduleType = 'REGULAR' | 'RAMADAN';
export type ExceptionType = 'CANCELLATION' | 'SUBSTITUTION' | 'REPLACEMENT' | 'HOLIDAY';
export type ClassStatus = 'SCHEDULED' | 'CANCELLED' | 'SUBSTITUTED' | 'REPLACED';

/** A scheduled class as stored in the published plan (denormalised subject/teacher for display). */
export interface ScheduledClassInput {
  sectionId: string;
  scheduleType: ScheduleType;
  dayOfWeek: DayOfWeek;
  classNumber: number;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  teacherId: string | null;
  teacherName: string | null;
  /** null ⇒ lesson occurs in the section's assigned classroom (never displayed as a room number). */
  locationName: string | null;
}

/** A date-specific override (ScheduleException model), keyed by `classNumber`. */
export interface ExceptionInput {
  classNumber: number | null; // null + HOLIDAY ⇒ whole-day
  type: ExceptionType;
  subjectName: string | null;
  teacherId: string | null; // replacement teacher
  teacherName: string | null;
  substituteTeacherId: string | null;
  substituteTeacherName: string | null;
  note: string | null;
}

export interface RamadanConfig {
  ramadanModeEnabled: boolean;
  ramadanStartDate: Date | null;
  ramadanEndDate: Date | null;
}

export interface ResolvedClass {
  classNumber: number;
  startTime: string;
  endTime: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  teacherId: string | null;
  teacherName: string | null;
  locationName: string | null;
  status: ClassStatus;
  substituteTeacherId: string | null;
  substituteTeacherName: string | null;
  note: string | null;
}

export interface ResolvedDay {
  scheduleType: ScheduleType;
  dayOfWeek: DayOfWeek;
  isHoliday: boolean;
  classes: ResolvedClass[];
}

/** High-level "what's happening now" state for the live cards. */
export type LiveState =
  | 'IN_CLASS'
  | 'BEFORE_SCHOOL'
  | 'MORNING_ASSEMBLY'
  | 'BREAK'
  | 'LUNCH_BREAK'
  | 'AFTER_SCHOOL'
  | 'HOLIDAY'
  | 'NO_CLASSES';

/** A non-teaching window from the section's bell schedule (assembly / break / lunch). */
export interface BreakWindow {
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  kind: 'ASSEMBLY' | 'LUNCH' | 'BREAK';
  label: string | null;
}

export interface LiveClassContext {
  state: LiveState;
  /** Label for a labelled break window (e.g. "Morning Assembly", "Lunch Break"), else null. */
  stateLabel: string | null;
  current: ResolvedClass | null;
  next: ResolvedClass | null;
  /** Non-cancelled classes that have not yet ended today. */
  remainingClasses: number;
  /** Minutes until the current class ends (null when not in a class). */
  minutesUntilCurrentEnds: number | null;
  /** Minutes until the next class starts (null when there is no next class). */
  minutesUntilNextStarts: number | null;
}

const DAY_INDEX: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const WEEKDAY_MAP: Record<string, DayOfWeek> = {
  Sun: 'SUN',
  Mon: 'MON',
  Tue: 'TUE',
  Wed: 'WED',
  Thu: 'THU',
  Fri: 'FRI',
  Sat: 'SAT',
};

/** Map a JS Date (interpreted in UTC) to the day-of-week enum. */
export function dayOfWeekOf(date: Date): DayOfWeek {
  return DAY_INDEX[date.getUTCDay()]!;
}

/**
 * Resolve an absolute instant into the wall-clock the SCHOOL sees, in its IANA timezone. Returns the
 * local day-of-week, minutes-since-local-midnight, and the local calendar date (as a UTC-midnight
 * Date, so it lines up with @db.Date columns). DST-correct and deterministic (driven by the ICU tz
 * database) — the scheduling engine never assumes UTC or server-local time.
 */
export function zonedNow(
  instant: Date,
  timeZone: string,
): { dayOfWeek: DayOfWeek; minutes: number; date: Date } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';

  let hour = Number(get('hour'));
  if (hour === 24) hour = 0; // some ICU builds render midnight as "24"
  const minute = Number(get('minute'));
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));

  return {
    dayOfWeek: WEEKDAY_MAP[get('weekday')] ?? dayOfWeekOf(instant),
    minutes: hour * 60 + minute,
    date: new Date(Date.UTC(year, month - 1, day)),
  };
}

/** Parse "HH:MM" into minutes-since-midnight. Throws on malformed input. */
export function timeToMinutes(hhmm: string): number {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) throw new Error(`Invalid time "${hhmm}"`);
  return Number(match[1]) * 60 + Number(match[2]);
}

function atUtcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** True when `date` falls within an active Ramadan window (inclusive, compared by UTC calendar day). */
export function isRamadanActive(config: RamadanConfig | null, date: Date): boolean {
  if (!config?.ramadanModeEnabled || !config.ramadanStartDate || !config.ramadanEndDate) {
    return false;
  }
  const day = atUtcMidnight(date);
  return (
    day >= atUtcMidnight(config.ramadanStartDate) && day <= atUtcMidnight(config.ramadanEndDate)
  );
}

export function resolveScheduleType(config: RamadanConfig | null, date: Date): ScheduleType {
  return isRamadanActive(config, date) ? 'RAMADAN' : 'REGULAR';
}

/** Resolve a section's schedule for a given day, overlaying exceptions on the published classes. */
export function resolveDay(params: {
  classes: ScheduledClassInput[];
  exceptions: ExceptionInput[];
  scheduleType: ScheduleType;
  dayOfWeek: DayOfWeek;
}): ResolvedDay {
  const { classes, exceptions, scheduleType, dayOfWeek } = params;

  const holiday = exceptions.find((e) => e.type === 'HOLIDAY' && e.classNumber === null);
  if (holiday) {
    return { scheduleType, dayOfWeek, isHoliday: true, classes: [] };
  }

  const exceptionByClass = new Map<number, ExceptionInput>();
  for (const e of exceptions) {
    if (e.classNumber !== null) exceptionByClass.set(e.classNumber, e);
  }

  const resolved = classes
    .filter((c) => c.scheduleType === scheduleType && c.dayOfWeek === dayOfWeek)
    .sort((a, b) => a.classNumber - b.classNumber)
    .map((c) => applyException(c, exceptionByClass.get(c.classNumber)));

  return { scheduleType, dayOfWeek, isHoliday: false, classes: resolved };
}

/** Current and next class for a wall-clock time (minutes since midnight). Skips cancelled classes. */
export function findCurrentAndNext(
  classes: ResolvedClass[],
  nowMinutes: number,
): { current: ResolvedClass | null; next: ResolvedClass | null } {
  const active = classes.filter((c) => c.status !== 'CANCELLED');
  let current: ResolvedClass | null = null;
  let next: ResolvedClass | null = null;

  for (const c of active) {
    const start = timeToMinutes(c.startTime);
    const end = timeToMinutes(c.endTime);
    if (nowMinutes >= start && nowMinutes < end) {
      current = c;
    } else if (start > nowMinutes && (next === null || start < timeToMinutes(next.startTime))) {
      next = c;
    }
  }
  return { current, next };
}

/**
 * Build the full live context for the Parent/Student/Teacher "now" cards. Reusable across every
 * surface — the current class is always calculated, never stored. Optional `breaks` (from the
 * section's bell schedule) refine the between-class state into Morning Assembly / Lunch Break.
 */
export function buildLiveContext(
  day: ResolvedDay,
  nowMinutes: number,
  breaks: BreakWindow[] = [],
): LiveClassContext {
  if (day.isHoliday) {
    return emptyContext('HOLIDAY');
  }
  const active = day.classes.filter((c) => c.status !== 'CANCELLED');
  if (active.length === 0) {
    return emptyContext('NO_CLASSES');
  }

  const { current, next } = findCurrentAndNext(day.classes, nowMinutes);
  const remainingClasses = active.filter((c) => timeToMinutes(c.endTime) > nowMinutes).length;

  const firstStart = Math.min(...active.map((c) => timeToMinutes(c.startTime)));
  const lastEnd = Math.max(...active.map((c) => timeToMinutes(c.endTime)));

  let state: LiveState;
  let stateLabel: string | null = null;
  if (current) {
    state = 'IN_CLASS';
  } else {
    // A labelled break window (assembly/lunch/break) wins over the coarse before/after/between state.
    const window = breaks.find(
      (b) => nowMinutes >= timeToMinutes(b.startTime) && nowMinutes < timeToMinutes(b.endTime),
    );
    if (window) {
      state =
        window.kind === 'ASSEMBLY'
          ? 'MORNING_ASSEMBLY'
          : window.kind === 'LUNCH'
            ? 'LUNCH_BREAK'
            : 'BREAK';
      stateLabel = window.label;
    } else if (nowMinutes < firstStart) {
      state = 'BEFORE_SCHOOL';
    } else if (nowMinutes >= lastEnd) {
      state = 'AFTER_SCHOOL';
    } else {
      state = 'BREAK';
    }
  }

  return {
    state,
    stateLabel,
    current,
    next,
    remainingClasses,
    minutesUntilCurrentEnds: current ? timeToMinutes(current.endTime) - nowMinutes : null,
    minutesUntilNextStarts: next ? timeToMinutes(next.startTime) - nowMinutes : null,
  };
}

// ----- Conflict detection ---------------------------------------------------

export type ConflictType =
  | 'TEACHER_DOUBLE_BOOKING'
  | 'SECTION_OVERLAP'
  | 'DUPLICATE_CLASS_NUMBER'
  | 'INVALID_SEQUENCE'
  | 'SUBJECT_DUPLICATION'
  | 'MISSING_TEACHER'
  | 'MISSING_SUBJECT'
  | 'INVALID_TIME';

export type ConflictSeverity = 'ERROR' | 'WARNING';

export interface Conflict {
  type: ConflictType;
  severity: ConflictSeverity;
  message: string;
  scheduleType: ScheduleType;
  dayOfWeek: DayOfWeek;
  /** Ids of the ScheduledClass rows involved (1 for single-class issues, 2 for pairwise clashes). */
  classIds: string[];
}

/** A ScheduledClass with the ids needed to describe a conflict. */
export interface ConflictClassInput extends ScheduledClassInput {
  id: string;
}

/**
 * Detect every conflict across a plan's classes (all sections). Publishing must be blocked while any
 * ERROR-severity conflict remains; WARNINGs (e.g. subject taught twice in a day) are advisory.
 */
export function detectConflicts(classes: ConflictClassInput[]): Conflict[] {
  const conflicts: Conflict[] = [];

  // Single-class checks.
  for (const c of classes) {
    if (timeToMinutes(c.startTime) >= timeToMinutes(c.endTime)) {
      conflicts.push({
        type: 'INVALID_TIME',
        severity: 'ERROR',
        message: `Class ${c.classNumber} (${c.subjectName}) starts at or after it ends.`,
        scheduleType: c.scheduleType,
        dayOfWeek: c.dayOfWeek,
        classIds: [c.id],
      });
    }
    if (!c.teacherId) {
      conflicts.push({
        type: 'MISSING_TEACHER',
        severity: 'ERROR',
        message: `Class ${c.classNumber} (${c.subjectName}) has no teacher assigned.`,
        scheduleType: c.scheduleType,
        dayOfWeek: c.dayOfWeek,
        classIds: [c.id],
      });
    }
    if (!c.subjectId) {
      conflicts.push({
        type: 'MISSING_SUBJECT',
        severity: 'ERROR',
        message: `Class ${c.classNumber} has no subject assigned.`,
        scheduleType: c.scheduleType,
        dayOfWeek: c.dayOfWeek,
        classIds: [c.id],
      });
    }
  }

  // Pairwise checks within the same (scheduleType, dayOfWeek) bucket only.
  const buckets = new Map<string, ConflictClassInput[]>();
  for (const c of classes) {
    const key = `${c.scheduleType}|${c.dayOfWeek}`;
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(c);
  }

  for (const bucket of buckets.values()) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i]!;
        const b = bucket[j]!;
        const overlap = timeOverlaps(a, b);

        if (a.teacherId && b.teacherId && a.teacherId === b.teacherId && overlap) {
          conflicts.push({
            type: 'TEACHER_DOUBLE_BOOKING',
            severity: 'ERROR',
            message: `${a.teacherName ?? 'Teacher'} is booked for two overlapping classes.`,
            scheduleType: a.scheduleType,
            dayOfWeek: a.dayOfWeek,
            classIds: [a.id, b.id],
          });
        }

        if (a.sectionId === b.sectionId && overlap) {
          conflicts.push({
            type: 'SECTION_OVERLAP',
            severity: 'ERROR',
            message: `Section has two overlapping classes (${a.subjectName} / ${b.subjectName}).`,
            scheduleType: a.scheduleType,
            dayOfWeek: a.dayOfWeek,
            classIds: [a.id, b.id],
          });
        }

        if (a.sectionId === b.sectionId && a.classNumber === b.classNumber) {
          conflicts.push({
            type: 'DUPLICATE_CLASS_NUMBER',
            severity: 'ERROR',
            message: `Section has two classes numbered ${a.classNumber} on the same day.`,
            scheduleType: a.scheduleType,
            dayOfWeek: a.dayOfWeek,
            classIds: [a.id, b.id],
          });
        }

        // Invalid sequence: a lower class number must not start later than a higher one.
        if (
          a.sectionId === b.sectionId &&
          a.classNumber !== b.classNumber &&
          !overlap &&
          a.classNumber < b.classNumber === timeToMinutes(a.startTime) > timeToMinutes(b.startTime)
          // ^ ordering by class number disagrees with ordering by start time
        ) {
          conflicts.push({
            type: 'INVALID_SEQUENCE',
            severity: 'ERROR',
            message: `Class numbering is out of order with the class times.`,
            scheduleType: a.scheduleType,
            dayOfWeek: a.dayOfWeek,
            classIds: [a.id, b.id],
          });
        }

        if (a.sectionId === b.sectionId && a.subjectId === b.subjectId && !overlap) {
          conflicts.push({
            type: 'SUBJECT_DUPLICATION',
            severity: 'WARNING',
            message: `${a.subjectName} is scheduled twice for this section on the same day.`,
            scheduleType: a.scheduleType,
            dayOfWeek: a.dayOfWeek,
            classIds: [a.id, b.id],
          });
        }
      }
    }
  }

  return conflicts;
}

/** True when the plan can be published: no ERROR-severity conflicts. */
export function canPublish(conflicts: Conflict[]): boolean {
  return !conflicts.some((c) => c.severity === 'ERROR');
}

// ----- internals -----------------------------------------------------------

function timeOverlaps(a: ScheduledClassInput, b: ScheduledClassInput): boolean {
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

function emptyContext(state: LiveState): LiveClassContext {
  return {
    state,
    stateLabel: null,
    current: null,
    next: null,
    remainingClasses: 0,
    minutesUntilCurrentEnds: null,
    minutesUntilNextStarts: null,
  };
}

function applyException(
  c: ScheduledClassInput,
  exception: ExceptionInput | undefined,
): ResolvedClass {
  const base: ResolvedClass = {
    classNumber: c.classNumber,
    startTime: c.startTime,
    endTime: c.endTime,
    subjectId: c.subjectId,
    subjectName: c.subjectName,
    subjectColor: c.subjectColor,
    teacherId: c.teacherId,
    teacherName: c.teacherName,
    locationName: c.locationName,
    status: 'SCHEDULED',
    substituteTeacherId: null,
    substituteTeacherName: null,
    note: null,
  };
  if (!exception) return base;

  switch (exception.type) {
    case 'CANCELLATION':
    case 'HOLIDAY':
      return { ...base, status: 'CANCELLED', note: exception.note };
    case 'SUBSTITUTION':
      return {
        ...base,
        status: 'SUBSTITUTED',
        substituteTeacherId: exception.substituteTeacherId,
        substituteTeacherName: exception.substituteTeacherName,
        note: exception.note,
      };
    case 'REPLACEMENT':
      return {
        ...base,
        status: 'REPLACED',
        subjectName: exception.subjectName ?? base.subjectName,
        teacherId: exception.teacherId ?? base.teacherId,
        teacherName: exception.teacherName ?? base.teacherName,
        note: exception.note,
      };
    default:
      return base;
  }
}

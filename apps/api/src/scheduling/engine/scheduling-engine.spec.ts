import {
  resolveDay,
  resolveScheduleType,
  isRamadanActive,
  buildLiveContext,
  detectConflicts,
  canPublish,
  timeToMinutes,
  zonedNow,
  type ScheduledClassInput,
  type ConflictClassInput,
  type ExceptionInput,
  type RamadanConfig,
} from './scheduling-engine';

const klass = (over: Partial<ScheduledClassInput> = {}): ScheduledClassInput => ({
  sectionId: 'sec-1',
  scheduleType: 'REGULAR',
  dayOfWeek: 'SUN',
  classNumber: 1,
  startTime: '08:00',
  endTime: '08:45',
  subjectId: 'subj-math',
  subjectName: 'Math',
  subjectColor: '#f00',
  teacherId: 'teacher-1',
  teacherName: 'Ahmed',
  locationName: null,
  ...over,
});

const conflictKlass = (over: Partial<ConflictClassInput> = {}): ConflictClassInput => ({
  id: 'c1',
  ...klass(over),
  ...over,
});

const exception = (over: Partial<ExceptionInput> = {}): ExceptionInput => ({
  classNumber: 1,
  type: 'CANCELLATION',
  subjectName: null,
  teacherId: null,
  teacherName: null,
  substituteTeacherId: null,
  substituteTeacherName: null,
  note: null,
  ...over,
});

describe('scheduling-engine — resolveDay', () => {
  it('returns matching classes sorted by classNumber', () => {
    const day = resolveDay({
      classes: [
        klass({ classNumber: 2, startTime: '08:50', endTime: '09:35' }),
        klass({ classNumber: 1 }),
      ],
      exceptions: [],
      scheduleType: 'REGULAR',
      dayOfWeek: 'SUN',
    });
    expect(day.classes.map((c) => c.classNumber)).toEqual([1, 2]);
    expect(day.isHoliday).toBe(false);
  });

  it('whole-day HOLIDAY cancels the day', () => {
    const day = resolveDay({
      classes: [klass()],
      exceptions: [exception({ classNumber: null, type: 'HOLIDAY' })],
      scheduleType: 'REGULAR',
      dayOfWeek: 'SUN',
    });
    expect(day.isHoliday).toBe(true);
    expect(day.classes).toHaveLength(0);
  });

  it('filters out the RAMADAN set on a regular day', () => {
    const day = resolveDay({
      classes: [klass(), klass({ scheduleType: 'RAMADAN', subjectName: 'Short Math' })],
      exceptions: [],
      scheduleType: 'REGULAR',
      dayOfWeek: 'SUN',
    });
    expect(day.classes).toHaveLength(1);
    expect(day.classes[0]!.subjectName).toBe('Math');
  });

  it('applies cancellation / substitution / replacement', () => {
    const day = resolveDay({
      classes: [
        klass({ classNumber: 1 }),
        klass({ classNumber: 2, startTime: '09:00', endTime: '09:45' }),
        klass({ classNumber: 3, startTime: '10:00', endTime: '10:45' }),
      ],
      exceptions: [
        exception({ classNumber: 1, type: 'CANCELLATION' }),
        exception({
          classNumber: 2,
          type: 'SUBSTITUTION',
          substituteTeacherId: 't-2',
          substituteTeacherName: 'Sara',
        }),
        exception({
          classNumber: 3,
          type: 'REPLACEMENT',
          subjectName: 'Exam',
          teacherName: 'Omar',
        }),
      ],
      scheduleType: 'REGULAR',
      dayOfWeek: 'SUN',
    });
    expect(day.classes[0]!.status).toBe('CANCELLED');
    expect(day.classes[1]!.status).toBe('SUBSTITUTED');
    expect(day.classes[1]!.substituteTeacherName).toBe('Sara');
    expect(day.classes[2]!.status).toBe('REPLACED');
    expect(day.classes[2]!.subjectName).toBe('Exam');
  });
});

describe('scheduling-engine — Ramadan', () => {
  const cfg: RamadanConfig = {
    ramadanModeEnabled: true,
    ramadanStartDate: new Date('2026-03-01'),
    ramadanEndDate: new Date('2026-03-30'),
  };
  it('is inclusive of the bounds', () => {
    expect(isRamadanActive(cfg, new Date('2026-03-01'))).toBe(true);
    expect(isRamadanActive(cfg, new Date('2026-03-30'))).toBe(true);
    expect(isRamadanActive(cfg, new Date('2026-03-31'))).toBe(false);
  });
  it('resolveScheduleType switches sets', () => {
    expect(resolveScheduleType(cfg, new Date('2026-03-10'))).toBe('RAMADAN');
    expect(resolveScheduleType(cfg, new Date('2026-04-10'))).toBe('REGULAR');
    expect(resolveScheduleType(null, new Date('2026-03-10'))).toBe('REGULAR');
  });
});

describe('scheduling-engine — zonedNow (timezone resolution)', () => {
  it('resolves the school wall-clock, not UTC (Asia/Amman is UTC+3)', () => {
    const z = zonedNow(new Date('2026-06-01T05:30:00Z'), 'Asia/Amman');
    expect(z.minutes).toBe(timeToMinutes('08:30')); // 05:30 UTC → 08:30 local
    expect(z.dayOfWeek).toBe('MON');
    expect(z.date.toISOString().slice(0, 10)).toBe('2026-06-01');
  });

  it('rolls the local calendar day/weekday across the UTC midnight boundary', () => {
    // 21:30 UTC Monday → 00:30 Tuesday in Amman: day, weekday and date all advance.
    const z = zonedNow(new Date('2026-06-01T21:30:00Z'), 'Asia/Amman');
    expect(z.minutes).toBe(30);
    expect(z.dayOfWeek).toBe('TUE');
    expect(z.date.toISOString().slice(0, 10)).toBe('2026-06-02');
  });

  it('applies DST for a zone that observes it (Europe/London, BST=+1 in July)', () => {
    const z = zonedNow(new Date('2026-07-01T10:00:00Z'), 'Europe/London');
    expect(z.minutes).toBe(timeToMinutes('11:00'));
  });
});

describe('scheduling-engine — buildLiveContext', () => {
  const day = resolveDay({
    classes: [
      klass({ classNumber: 1, startTime: '08:00', endTime: '08:45' }),
      klass({ classNumber: 2, startTime: '09:00', endTime: '09:45' }),
    ],
    exceptions: [],
    scheduleType: 'REGULAR',
    dayOfWeek: 'SUN',
  });

  it('BEFORE_SCHOOL before the first class', () => {
    const ctx = buildLiveContext(day, timeToMinutes('07:30'));
    expect(ctx.state).toBe('BEFORE_SCHOOL');
    expect(ctx.next?.classNumber).toBe(1);
    expect(ctx.remainingClasses).toBe(2);
    expect(ctx.minutesUntilNextStarts).toBe(30);
  });
  it('IN_CLASS during a class', () => {
    const ctx = buildLiveContext(day, timeToMinutes('08:10'));
    expect(ctx.state).toBe('IN_CLASS');
    expect(ctx.current?.classNumber).toBe(1);
    expect(ctx.minutesUntilCurrentEnds).toBe(35);
    expect(ctx.next?.classNumber).toBe(2);
  });
  it('BREAK between classes', () => {
    const ctx = buildLiveContext(day, timeToMinutes('08:50'));
    expect(ctx.state).toBe('BREAK');
    expect(ctx.current).toBeNull();
    expect(ctx.next?.classNumber).toBe(2);
    expect(ctx.remainingClasses).toBe(1);
  });
  it('AFTER_SCHOOL past the last class', () => {
    const ctx = buildLiveContext(day, timeToMinutes('10:00'));
    expect(ctx.state).toBe('AFTER_SCHOOL');
    expect(ctx.remainingClasses).toBe(0);
  });
  it('HOLIDAY / NO_CLASSES', () => {
    const holiday = resolveDay({
      classes: [klass()],
      exceptions: [exception({ classNumber: null, type: 'HOLIDAY' })],
      scheduleType: 'REGULAR',
      dayOfWeek: 'SUN',
    });
    expect(buildLiveContext(holiday, 600).state).toBe('HOLIDAY');
    const empty = resolveDay({
      classes: [],
      exceptions: [],
      scheduleType: 'REGULAR',
      dayOfWeek: 'FRI',
    });
    expect(buildLiveContext(empty, 600).state).toBe('NO_CLASSES');
  });

  it('MORNING_ASSEMBLY / LUNCH_BREAK from bell-schedule windows', () => {
    const assembly = buildLiveContext(day, timeToMinutes('07:40'), [
      { startTime: '07:30', endTime: '08:00', kind: 'ASSEMBLY', label: 'Morning Assembly' },
    ]);
    expect(assembly.state).toBe('MORNING_ASSEMBLY');
    expect(assembly.stateLabel).toBe('Morning Assembly');

    const lunch = buildLiveContext(day, timeToMinutes('08:50'), [
      { startTime: '08:45', endTime: '09:00', kind: 'LUNCH', label: 'Lunch Break' },
    ]);
    expect(lunch.state).toBe('LUNCH_BREAK');
  });
});

describe('scheduling-engine — detectConflicts', () => {
  it('flags a teacher double-booked across sections', () => {
    const conflicts = detectConflicts([
      conflictKlass({
        id: 'a',
        sectionId: 'sec-1',
        teacherId: 't-1',
        startTime: '08:00',
        endTime: '08:45',
      }),
      conflictKlass({
        id: 'b',
        sectionId: 'sec-2',
        teacherId: 't-1',
        startTime: '08:30',
        endTime: '09:15',
      }),
    ]);
    expect(conflicts.some((c) => c.type === 'TEACHER_DOUBLE_BOOKING')).toBe(true);
    expect(canPublish(conflicts)).toBe(false);
  });

  it('flags overlapping classes within a section', () => {
    const conflicts = detectConflicts([
      conflictKlass({ id: 'a', classNumber: 1, startTime: '08:00', endTime: '09:00' }),
      conflictKlass({
        id: 'b',
        classNumber: 2,
        startTime: '08:30',
        endTime: '09:30',
        teacherId: 't-2',
      }),
    ]);
    expect(conflicts.some((c) => c.type === 'SECTION_OVERLAP')).toBe(true);
  });

  it('flags a missing teacher and invalid time as errors', () => {
    const conflicts = detectConflicts([
      conflictKlass({ id: 'a', teacherId: null }),
      conflictKlass({ id: 'b', classNumber: 2, startTime: '10:00', endTime: '09:00' }),
    ]);
    expect(conflicts.some((c) => c.type === 'MISSING_TEACHER')).toBe(true);
    expect(conflicts.some((c) => c.type === 'INVALID_TIME')).toBe(true);
    expect(canPublish(conflicts)).toBe(false);
  });

  it('subject duplication is a non-blocking warning', () => {
    const conflicts = detectConflicts([
      conflictKlass({
        id: 'a',
        classNumber: 1,
        subjectId: 'subj-math',
        startTime: '08:00',
        endTime: '08:45',
      }),
      conflictKlass({
        id: 'b',
        classNumber: 2,
        subjectId: 'subj-math',
        startTime: '09:00',
        endTime: '09:45',
        teacherId: 't-2',
      }),
    ]);
    const dup = conflicts.find((c) => c.type === 'SUBJECT_DUPLICATION');
    expect(dup?.severity).toBe('WARNING');
    expect(canPublish(conflicts)).toBe(true);
  });

  it('flags a duplicate class number and an out-of-order sequence', () => {
    const dup = detectConflicts([
      conflictKlass({ id: 'a', classNumber: 1, startTime: '08:00', endTime: '08:45' }),
      conflictKlass({
        id: 'b',
        classNumber: 1,
        startTime: '09:00',
        endTime: '09:45',
        teacherId: 't-2',
      }),
    ]);
    expect(dup.some((c) => c.type === 'DUPLICATE_CLASS_NUMBER')).toBe(true);

    const seq = detectConflicts([
      conflictKlass({ id: 'a', classNumber: 1, startTime: '10:00', endTime: '10:45' }),
      conflictKlass({
        id: 'b',
        classNumber: 2,
        startTime: '08:00',
        endTime: '08:45',
        teacherId: 't-2',
      }),
    ]);
    expect(seq.some((c) => c.type === 'INVALID_SEQUENCE')).toBe(true);
  });

  it('flags a missing subject as an error', () => {
    const conflicts = detectConflicts([conflictKlass({ id: 'a', subjectId: '' })]);
    expect(conflicts.some((c) => c.type === 'MISSING_SUBJECT')).toBe(true);
    expect(canPublish(conflicts)).toBe(false);
  });

  it('a clean plan publishes', () => {
    const conflicts = detectConflicts([
      conflictKlass({ id: 'a', classNumber: 1, startTime: '08:00', endTime: '08:45' }),
      conflictKlass({
        id: 'b',
        classNumber: 2,
        subjectId: 'subj-sci',
        subjectName: 'Science',
        startTime: '09:00',
        endTime: '09:45',
        teacherId: 't-2',
      }),
    ]);
    expect(conflicts).toHaveLength(0);
    expect(canPublish(conflicts)).toBe(true);
  });
});

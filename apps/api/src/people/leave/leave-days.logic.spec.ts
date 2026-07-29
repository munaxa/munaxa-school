import {
  calendarFromDates,
  isWeekend,
  isWorkingDay,
  toDayKey,
  workingDaysBetween,
} from './leave-days.logic';

describe('leave working-day arithmetic', () => {
  it('flags Fri/Sat as weekend', () => {
    expect(isWeekend(new Date('2026-03-06'))).toBe(true); // Friday
    expect(isWeekend(new Date('2026-03-07'))).toBe(true); // Saturday
    expect(isWeekend(new Date('2026-03-08'))).toBe(false); // Sunday (a working day)
  });

  it('counts a single working day inclusively', () => {
    expect(workingDaysBetween(new Date('2026-03-08'), new Date('2026-03-08'))).toBe(1);
  });

  it('excludes the weekend across a span', () => {
    // Sun 2026-03-08 → Thu 2026-03-12 = 5 working days (no weekend inside).
    expect(workingDaysBetween(new Date('2026-03-08'), new Date('2026-03-12'))).toBe(5);
    // Sun 2026-03-08 → Sun 2026-03-15 spans one Fri+Sat → 8 calendar, 6 working.
    expect(workingDaysBetween(new Date('2026-03-08'), new Date('2026-03-15'))).toBe(6);
  });

  it('returns 0 when end precedes start', () => {
    expect(workingDaysBetween(new Date('2026-03-10'), new Date('2026-03-01'))).toBe(0);
  });

  it('counts a weekend-only span as zero', () => {
    // Fri + Sat only.
    expect(workingDaysBetween(new Date('2026-03-06'), new Date('2026-03-07'))).toBe(0);
  });

  describe('calendar-awareness (backward compatible)', () => {
    it('is identical to weekend-only counting when no calendar is passed', () => {
      // Regression guard: the 3-arg form with undefined calendar == the original 2-arg behaviour.
      expect(workingDaysBetween(new Date('2026-03-08'), new Date('2026-03-15'), undefined)).toBe(6);
    });

    it('excludes calendar holidays from the working-day count', () => {
      // Sun→Thu = 5 working; mark Tue 2026-03-10 a holiday → 4.
      const calendar = calendarFromDates(['2026-03-10']);
      expect(workingDaysBetween(new Date('2026-03-08'), new Date('2026-03-12'), calendar)).toBe(4);
    });

    it('includes a special (make-up) working day that overrides the weekend', () => {
      // Fri+Sat only would be 0; declare Sat 2026-03-07 a special working day → 1.
      const calendar = calendarFromDates([], ['2026-03-07']);
      expect(workingDaysBetween(new Date('2026-03-06'), new Date('2026-03-07'), calendar)).toBe(1);
    });

    it('lets a special working day win over a same-day holiday flag', () => {
      const calendar = calendarFromDates(['2026-03-07'], ['2026-03-07']);
      expect(isWorkingDay(new Date('2026-03-07'), calendar)).toBe(true);
    });

    it('treats a weekday holiday as non-working via isWorkingDay', () => {
      const calendar = calendarFromDates(['2026-03-09']); // Monday
      expect(isWorkingDay(new Date('2026-03-09'), calendar)).toBe(false);
    });

    it('normalises Date and ISO strings to the same day key', () => {
      expect(toDayKey(new Date('2026-03-09T23:59:00.000Z'))).toBe('2026-03-09');
      expect(toDayKey('2026-03-09T00:00:00.000Z')).toBe('2026-03-09');
    });
  });
});

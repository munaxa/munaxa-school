import type { AttendanceStatus } from '@prisma/client';
import { computeStreaks } from './gamification.service';

const day = (d: string, status: AttendanceStatus) => ({ date: new Date(d), status });

describe('computeStreaks', () => {
  it('returns zeros for no attendance', () => {
    expect(computeStreaks([])).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      totalPresentDays: 0,
    });
  });

  it('counts a clean run of present days', () => {
    const rows = [
      day('2026-06-01', 'PRESENT'),
      day('2026-06-02', 'PRESENT'),
      day('2026-06-03', 'LATE'),
    ];
    expect(computeStreaks(rows)).toEqual({
      currentStreak: 3,
      longestStreak: 3,
      totalPresentDays: 3,
    });
  });

  it('breaks the current streak on an ABSENT day but keeps the longest', () => {
    // chronological: P P P A P P  → most recent is a 2-day run; longest is 3.
    const rows = [
      day('2026-06-01', 'PRESENT'),
      day('2026-06-02', 'PRESENT'),
      day('2026-06-03', 'PRESENT'),
      day('2026-06-04', 'ABSENT'),
      day('2026-06-05', 'PRESENT'),
      day('2026-06-06', 'PRESENT'),
    ];
    expect(computeStreaks(rows)).toEqual({
      currentStreak: 2,
      longestStreak: 3,
      totalPresentDays: 5,
    });
  });

  it('treats EXCUSED as neutral (neither breaks nor extends)', () => {
    const rows = [
      day('2026-06-01', 'PRESENT'),
      day('2026-06-02', 'EXCUSED'),
      day('2026-06-03', 'PRESENT'),
    ];
    expect(computeStreaks(rows)).toEqual({
      currentStreak: 2,
      longestStreak: 2,
      totalPresentDays: 2,
    });
  });

  it('collapses multiple periods per day (any ABSENT marks the day absent)', () => {
    const rows = [
      day('2026-06-01', 'PRESENT'),
      day('2026-06-01', 'ABSENT'), // same day, worst status wins → ABSENT
      day('2026-06-02', 'PRESENT'),
    ];
    expect(computeStreaks(rows)).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      totalPresentDays: 1,
    });
  });
});

import {
  expectedShiftMinutes,
  measureShift,
  minutesOfDay,
  type ShiftWindow,
} from './shift-window.logic';
import { evaluateAttendance } from './attendance-policy.logic';

const morning: ShiftWindow = {
  expectedCheckIn: '08:00',
  expectedCheckOut: '16:00',
  breakMinutes: 60,
};

const at = (hhmm: string): Date => new Date(`2026-03-08T${hhmm}:00.000Z`);

describe('shift-window engine', () => {
  it('computes expected minutes as gross window minus break', () => {
    expect(expectedShiftMinutes(morning)).toBe(8 * 60 - 60); // 420
  });

  it('reads minute-of-day in UTC', () => {
    expect(minutesOfDay(at('08:30'))).toBe(8 * 60 + 30);
  });

  it('measures an on-time complete day', () => {
    const m = measureShift(morning, { checkInAt: at('08:00'), checkOutAt: at('16:00') });
    expect(m).toEqual({
      checkedIn: true,
      lateMinutes: 0,
      earlyDepartureMinutes: 0,
      expectedMinutes: 420,
      workedMinutes: 420,
    });
  });

  it('derives lateness from a late check-in', () => {
    const m = measureShift(morning, { checkInAt: at('08:25'), checkOutAt: at('16:00') });
    expect(m.lateMinutes).toBe(25);
  });

  it('derives early departure from an early check-out', () => {
    const m = measureShift(morning, { checkInAt: at('08:00'), checkOutAt: at('15:30') });
    expect(m.earlyDepartureMinutes).toBe(30);
    expect(m.workedMinutes).toBe(390); // 7.5h − 60 break
  });

  it('treats a missing check-in as not checked in', () => {
    const m = measureShift(morning, { checkInAt: null, checkOutAt: null });
    expect(m.checkedIn).toBe(false);
    expect(m.workedMinutes).toBe(0);
  });

  it('yields 0 worked minutes for a check-in without a check-out', () => {
    const m = measureShift(morning, { checkInAt: at('08:00'), checkOutAt: null });
    expect(m.checkedIn).toBe(true);
    expect(m.workedMinutes).toBe(0);
  });

  it('caps credited worked minutes at maxHours', () => {
    const capped: ShiftWindow = { ...morning, maxHours: 6 };
    const m = measureShift(capped, { checkInAt: at('08:00'), checkOutAt: at('20:00') });
    expect(m.workedMinutes).toBe(360); // capped at 6h despite a 12h span
  });

  it('feeds the policy engine end-to-end (N1 → N2)', () => {
    // Late check-in + early check-out → LATE per default policy.
    const m = measureShift(morning, { checkInAt: at('08:20'), checkOutAt: at('15:00') });
    const verdict = evaluateAttendance(m);
    expect(verdict.status).toBe('LATE');
    expect(verdict.effectiveLateMinutes).toBe(15); // 20 − 5 grace
  });
});

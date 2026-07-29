import {
  DEFAULT_ATTENDANCE_POLICY,
  evaluateAttendance,
  type AttendanceMeasurement,
  type AttendancePolicyConfig,
} from './attendance-policy.logic';

const onTimeFullDay: AttendanceMeasurement = {
  checkedIn: true,
  lateMinutes: 0,
  earlyDepartureMinutes: 0,
  expectedMinutes: 480,
  workedMinutes: 480,
};

describe('attendance policy engine', () => {
  it('classifies an on-time full day as PRESENT with full fraction', () => {
    const result = evaluateAttendance(onTimeFullDay);
    expect(result).toEqual({
      status: 'PRESENT',
      effectiveLateMinutes: 0,
      earlyDepartureMinutes: 0,
      overtimeMinutes: 0,
      dayFraction: 1,
    });
  });

  it('forgives lateness within the grace window', () => {
    // 5 min late == grace → not late.
    const result = evaluateAttendance({ ...onTimeFullDay, lateMinutes: 5 });
    expect(result.status).toBe('PRESENT');
    expect(result.effectiveLateMinutes).toBe(0);
  });

  it('marks LATE once lateness exceeds grace by the late threshold', () => {
    const result = evaluateAttendance({ ...onTimeFullDay, lateMinutes: 20 });
    expect(result.status).toBe('LATE');
    expect(result.effectiveLateMinutes).toBe(15); // 20 − 5 grace
  });

  it('marks ABSENT when never checked in (fraction 0)', () => {
    const result = evaluateAttendance({ ...onTimeFullDay, checkedIn: false, workedMinutes: 0 });
    expect(result.status).toBe('ABSENT');
    expect(result.dayFraction).toBe(0);
  });

  it('marks ABSENT when lateness passes the absent threshold', () => {
    // 250 late − 5 grace = 245 ≥ 240 absent threshold.
    const result = evaluateAttendance({ ...onTimeFullDay, lateMinutes: 250, workedMinutes: 230 });
    expect(result.status).toBe('ABSENT');
    expect(result.dayFraction).toBe(0);
  });

  it('produces a half day when the worked shortfall crosses the threshold', () => {
    // Expected 480, worked 240 → shortfall 240 ≥ 180.
    const result = evaluateAttendance({ ...onTimeFullDay, workedMinutes: 240 });
    expect(result.dayFraction).toBe(0.5);
    expect(result.status).toBe('PRESENT');
  });

  it('flags EARLY_DEPARTURE when leaving early past the threshold (and not late)', () => {
    const result = evaluateAttendance({
      ...onTimeFullDay,
      earlyDepartureMinutes: 30,
      workedMinutes: 450,
    });
    expect(result.status).toBe('EARLY_DEPARTURE');
    expect(result.earlyDepartureMinutes).toBe(30);
  });

  it('prioritises LATE over EARLY_DEPARTURE when both apply', () => {
    const result = evaluateAttendance({
      ...onTimeFullDay,
      lateMinutes: 30,
      earlyDepartureMinutes: 30,
      workedMinutes: 420,
    });
    expect(result.status).toBe('LATE');
  });

  it('credits overtime only past the overtime threshold', () => {
    const under = evaluateAttendance({ ...onTimeFullDay, workedMinutes: 500 }); // +20 < 30
    expect(under.overtimeMinutes).toBe(0);
    const over = evaluateAttendance({ ...onTimeFullDay, workedMinutes: 540 }); // +60 ≥ 30
    expect(over.overtimeMinutes).toBe(60);
  });

  it('honours a custom policy (thresholds are data-driven, not hardcoded)', () => {
    const strict: AttendancePolicyConfig = {
      ...DEFAULT_ATTENDANCE_POLICY,
      graceMinutes: 0,
      lateAfterMinutes: 1,
    };
    const result = evaluateAttendance({ ...onTimeFullDay, lateMinutes: 1 }, strict);
    expect(result.status).toBe('LATE');
    expect(result.effectiveLateMinutes).toBe(1);
  });
});

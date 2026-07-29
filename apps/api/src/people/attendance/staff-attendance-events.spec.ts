import { isCorrection, staffAttendanceRecordedEvent } from './staff-attendance-events';

describe('staff-attendance-events', () => {
  const base = {
    tenantId: 't1',
    employeeId: 'e1',
    status: 'ABSENT',
    source: 'MANUAL',
  };

  it('builds a StaffAttendanceRecorded event with a normalised ISO day from a Date', () => {
    const event = staffAttendanceRecordedEvent({
      ...base,
      date: new Date('2026-03-15T09:30:00.000Z'),
    });
    expect(event).toEqual({
      type: 'StaffAttendanceRecorded',
      tenantId: 't1',
      employeeId: 'e1',
      date: '2026-03-15',
      status: 'ABSENT',
      source: 'MANUAL',
      previousStatus: null,
    });
  });

  it('normalises an ISO datetime string to the calendar day', () => {
    const event = staffAttendanceRecordedEvent({ ...base, date: '2026-03-15T00:00:00.000Z' });
    expect(event.date).toBe('2026-03-15');
  });

  it('defaults previousStatus to null when omitted', () => {
    const event = staffAttendanceRecordedEvent({ ...base, date: '2026-03-15' });
    expect(event.previousStatus).toBeNull();
    expect(isCorrection(event)).toBe(false);
  });

  it('flags a correction only when an existing status actually changed', () => {
    const corrected = staffAttendanceRecordedEvent({
      ...base,
      date: '2026-03-15',
      status: 'PRESENT',
      previousStatus: 'ABSENT',
    });
    expect(isCorrection(corrected)).toBe(true);

    const rewriteSame = staffAttendanceRecordedEvent({
      ...base,
      date: '2026-03-15',
      status: 'ABSENT',
      previousStatus: 'ABSENT',
    });
    expect(isCorrection(rewriteSame)).toBe(false);
  });
});

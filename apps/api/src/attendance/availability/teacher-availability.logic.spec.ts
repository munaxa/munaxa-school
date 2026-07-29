import { resolveTeacherAvailability } from './teacher-availability.logic';

describe('teacher availability read-model', () => {
  it('treats a teacher with no facts as available', () => {
    expect(resolveTeacherAvailability({})).toEqual({
      state: 'CAN_TEACH',
      canTeach: true,
      reason: null,
    });
  });

  it('does not treat a missing attendance record as absence', () => {
    expect(resolveTeacherAvailability({ attendanceStatus: null }).canTeach).toBe(true);
  });

  it('keeps a LATE teacher available (they still teach)', () => {
    expect(resolveTeacherAvailability({ attendanceStatus: 'LATE' }).canTeach).toBe(true);
  });

  it('marks PRESENT as available', () => {
    expect(resolveTeacherAvailability({ attendanceStatus: 'PRESENT' }).state).toBe('CAN_TEACH');
  });

  it('marks ABSENT as unavailable', () => {
    const r = resolveTeacherAvailability({ attendanceStatus: 'ABSENT' });
    expect(r).toEqual({ state: 'UNAVAILABLE', canTeach: false, reason: 'availability.absent' });
  });

  it('reports SUBSTITUTED when a substitute is assigned', () => {
    const r = resolveTeacherAvailability({ attendanceStatus: 'ABSENT', hasSubstitution: true });
    expect(r.state).toBe('SUBSTITUTED');
    expect(r.canTeach).toBe(false);
  });

  it('prioritises leave over substitution', () => {
    const r = resolveTeacherAvailability({ onApprovedLeave: true, hasSubstitution: true });
    expect(r.state).toBe('ON_LEAVE');
  });

  it('prioritises emergency over everything', () => {
    const r = resolveTeacherAvailability({
      emergency: true,
      onApprovedLeave: true,
      hasSubstitution: true,
      attendanceStatus: 'PRESENT',
    });
    expect(r.state).toBe('EMERGENCY');
    expect(r.canTeach).toBe(false);
  });

  it('reports TRAINING and MEETING for at-work-but-not-teaching', () => {
    expect(resolveTeacherAvailability({ onTraining: true }).state).toBe('TRAINING');
    expect(resolveTeacherAvailability({ inMeeting: true }).state).toBe('MEETING');
  });

  it('prioritises training over meeting', () => {
    expect(resolveTeacherAvailability({ onTraining: true, inMeeting: true }).state).toBe(
      'TRAINING',
    );
  });

  it('treats ON_LEAVE attendance the same as approved leave', () => {
    expect(resolveTeacherAvailability({ attendanceStatus: 'ON_LEAVE' }).state).toBe('ON_LEAVE');
  });
});

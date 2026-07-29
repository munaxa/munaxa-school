import { blocksTeaching, projectStaffStatusToTeacherStatus } from './staff-attendance-projection';

describe('staff → teacher attendance projection', () => {
  it('projects at-work statuses to PRESENT', () => {
    expect(projectStaffStatusToTeacherStatus('PRESENT')).toBe('PRESENT');
    expect(projectStaffStatusToTeacherStatus('REMOTE')).toBe('PRESENT');
    expect(projectStaffStatusToTeacherStatus('EARLY_DEPARTURE')).toBe('PRESENT');
  });

  it('preserves LATE as an academic fact', () => {
    expect(projectStaffStatusToTeacherStatus('LATE')).toBe('LATE');
  });

  it('projects ABSENT and ON_LEAVE directly', () => {
    expect(projectStaffStatusToTeacherStatus('ABSENT')).toBe('ABSENT');
    expect(projectStaffStatusToTeacherStatus('ON_LEAVE')).toBe('ON_LEAVE');
  });

  it('produces no academic record for HOLIDAY', () => {
    expect(projectStaffStatusToTeacherStatus('HOLIDAY')).toBeNull();
  });

  it('flags the statuses that stop a teacher taking classes', () => {
    expect(blocksTeaching('ABSENT')).toBe(true);
    expect(blocksTeaching('ON_LEAVE')).toBe(true);
    expect(blocksTeaching('PRESENT')).toBe(false);
    expect(blocksTeaching('LATE')).toBe(false);
  });
});

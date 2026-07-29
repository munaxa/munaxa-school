import { StaffAttendanceStatus } from '@prisma/client';
import { overlapWorkingDays, summarizeAttendance } from './payroll-prep.logic';

const day = (
  status: StaffAttendanceStatus,
  lateMinutes: number | null = null,
  overtimeHours: number | null = null,
) => ({ status, lateMinutes, overtimeHours });

describe('payroll-prep aggregation', () => {
  it('clamps approved-leave overlap to the reporting range and excludes weekends', () => {
    // Leave Wed 2026-03-11 → Wed 2026-03-18; range Sun 2026-03-08 → Thu 2026-03-12.
    // Overlap = Wed 11 + Thu 12 = 2 working days (Fri/Sat excluded, range clips the tail).
    const overlap = overlapWorkingDays(
      new Date('2026-03-08'),
      new Date('2026-03-12'),
      new Date('2026-03-11'),
      new Date('2026-03-18'),
    );
    expect(overlap).toBe(2);
  });

  it('returns zero overlap for leave entirely outside the range', () => {
    expect(
      overlapWorkingDays(
        new Date('2026-03-08'),
        new Date('2026-03-12'),
        new Date('2026-04-01'),
        new Date('2026-04-05'),
      ),
    ).toBe(0);
  });

  it('counts present/remote/absent/late and sums late minutes + overtime', () => {
    const summary = summarizeAttendance(
      6,
      [
        day(StaffAttendanceStatus.PRESENT, null, 1.5),
        day(StaffAttendanceStatus.LATE, 20, 0),
        day(StaffAttendanceStatus.EARLY_DEPARTURE),
        day(StaffAttendanceStatus.REMOTE),
        day(StaffAttendanceStatus.ABSENT),
      ],
      { paidLeaveDays: 0, unpaidLeaveDays: 0 },
    );
    expect(summary.presentDays).toBe(3); // present + late + early-departure
    expect(summary.remoteDays).toBe(1);
    expect(summary.absentDays).toBe(1);
    expect(summary.lateDays).toBe(1);
    expect(summary.lateMinutes).toBe(20);
    expect(summary.overtimeHours).toBe(1.5);
  });

  it('payable days deduct absences and unpaid leave, but not paid leave', () => {
    const summary = summarizeAttendance(
      20,
      [day(StaffAttendanceStatus.ABSENT), day(StaffAttendanceStatus.ABSENT)],
      { paidLeaveDays: 3, unpaidLeaveDays: 4 },
    );
    // 20 working − 2 absent − 4 unpaid = 14 payable (paid leave stays payable).
    expect(summary.payableDays).toBe(14);
    expect(summary.paidLeaveDays).toBe(3);
    expect(summary.unpaidLeaveDays).toBe(4);
  });

  it('never returns negative payable days', () => {
    const summary = summarizeAttendance(
      3,
      [day(StaffAttendanceStatus.ABSENT), day(StaffAttendanceStatus.ABSENT)],
      { paidLeaveDays: 0, unpaidLeaveDays: 5 },
    );
    expect(summary.payableDays).toBe(0);
  });

  it('rounds summed overtime to two decimals', () => {
    const summary = summarizeAttendance(
      2,
      [
        day(StaffAttendanceStatus.PRESENT, null, 0.1),
        day(StaffAttendanceStatus.PRESENT, null, 0.2),
      ],
      { paidLeaveDays: 0, unpaidLeaveDays: 0 },
    );
    expect(summary.overtimeHours).toBe(0.3);
  });
});

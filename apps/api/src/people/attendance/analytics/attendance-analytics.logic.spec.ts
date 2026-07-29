import {
  bucketOf,
  buildDepartmentStats,
  buildPunctuality,
  buildTrend,
  type AnalyticsRow,
} from './attendance-analytics.logic';

const row = (over: Partial<AnalyticsRow> = {}): AnalyticsRow => ({
  employeeId: 'e1',
  employeeName: 'Alpha One',
  departmentId: 'd1',
  departmentName: 'Teaching',
  date: '2026-03-02',
  status: 'PRESENT',
  lateMinutes: 0,
  overtimeHours: 0,
  ...over,
});

describe('attendance analytics aggregation', () => {
  it('buckets by day or month', () => {
    expect(bucketOf('2026-03-02', 'day')).toBe('2026-03-02');
    expect(bucketOf('2026-03-02', 'month')).toBe('2026-03');
  });

  it('builds a chronological trend with rates', () => {
    const trend = buildTrend([
      row({ date: '2026-03-02', status: 'PRESENT' }),
      row({ date: '2026-03-02', status: 'ABSENT' }),
      row({ date: '2026-03-01', status: 'LATE', lateMinutes: 10 }),
    ]);
    expect(trend.map((t) => t.bucket)).toEqual(['2026-03-01', '2026-03-02']);
    const day2 = trend[1]!;
    expect(day2.totalRecords).toBe(2);
    expect(day2.absent).toBe(1);
    expect(day2.absenceRate).toBe(0.5);
    const day1 = trend[0]!;
    expect(day1.late).toBe(1);
    expect(day1.latenessRate).toBe(1);
    expect(day1.lateMinutes).toBe(10);
  });

  it('counts LATE as both present and late', () => {
    const [point] = buildTrend([row({ status: 'LATE', lateMinutes: 5 })]);
    expect(point!.present).toBe(1);
    expect(point!.late).toBe(1);
  });

  it('aggregates months when asked', () => {
    const trend = buildTrend([row({ date: '2026-03-01' }), row({ date: '2026-03-20' })], 'month');
    expect(trend).toHaveLength(1);
    expect(trend[0]!.bucket).toBe('2026-03');
    expect(trend[0]!.totalRecords).toBe(2);
  });

  it('builds department stats with distinct employee counts, worst absence first', () => {
    const stats = buildDepartmentStats([
      row({ employeeId: 'e1', departmentId: 'd1', departmentName: 'Teaching' }),
      row({ employeeId: 'e1', departmentId: 'd1', departmentName: 'Teaching' }),
      row({ employeeId: 'e2', departmentId: 'd2', departmentName: 'Admin', status: 'ABSENT' }),
    ]);
    expect(stats[0]!.departmentName).toBe('Admin');
    expect(stats[0]!.absenceRate).toBe(1);
    const teaching = stats.find((s) => s.departmentId === 'd1')!;
    expect(teaching.employees).toBe(1);
    expect(teaching.records).toBe(2);
  });

  it('labels rows without a department as Unassigned', () => {
    const stats = buildDepartmentStats([row({ departmentId: null, departmentName: null })]);
    expect(stats[0]!.departmentName).toBe('Unassigned');
  });

  it('ranks punctuality worst-first and averages only over late days', () => {
    const stats = buildPunctuality([
      row({ employeeId: 'e1', status: 'PRESENT' }),
      row({ employeeId: 'e1', status: 'LATE', lateMinutes: 20 }),
      row({ employeeId: 'e2', employeeName: 'Beta Two', status: 'PRESENT' }),
    ]);
    expect(stats[0]!.employeeId).toBe('e1');
    expect(stats[0]!.punctualityScore).toBe(0.5);
    expect(stats[0]!.averageLateMinutes).toBe(20);
    expect(stats[1]!.punctualityScore).toBe(1);
    expect(stats[1]!.averageLateMinutes).toBe(0);
  });

  it('returns empty datasets for no rows', () => {
    expect(buildTrend([])).toEqual([]);
    expect(buildDepartmentStats([])).toEqual([]);
    expect(buildPunctuality([])).toEqual([]);
  });
});

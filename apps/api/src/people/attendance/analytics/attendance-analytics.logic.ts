/**
 * Attendance analytics aggregation (PR-12).
 *
 * Pure reducers turning raw attendance rows into export-ready datasets: trends, department
 * heatmaps, punctuality rankings and shift utilisation. Deliberately dependency-free so the maths
 * is unit-testable and identical whether it feeds an API response, a CSV export or a dashboard.
 *
 * Presentation (colours, chart types, layout) is **not** decided here — services emit datasets and
 * the UI renders them (Rule 5: no dashboard logic inside services).
 */
import type { StaffAttendanceStatus } from '@prisma/client';

/** One attendance fact, flattened for aggregation. */
export interface AnalyticsRow {
  employeeId: string;
  employeeName: string;
  departmentId: string | null;
  departmentName: string | null;
  /** `YYYY-MM-DD`. */
  date: string;
  status: StaffAttendanceStatus;
  lateMinutes: number;
  overtimeHours: number;
}

export interface TrendPoint {
  /** Bucket key — a day (`YYYY-MM-DD`) or a month (`YYYY-MM`). */
  bucket: string;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  totalRecords: number;
  lateMinutes: number;
  overtimeHours: number;
  /** Share of records that were absences, 0–1, rounded to 4dp. */
  absenceRate: number;
  /** Share of records that were late arrivals, 0–1, rounded to 4dp. */
  latenessRate: number;
}

export interface DepartmentStat {
  departmentId: string | null;
  departmentName: string;
  employees: number;
  records: number;
  absences: number;
  lates: number;
  lateMinutes: number;
  overtimeHours: number;
  absenceRate: number;
  latenessRate: number;
}

export interface PunctualityStat {
  employeeId: string;
  employeeName: string;
  records: number;
  lates: number;
  lateMinutes: number;
  /** Average lateness per late occurrence (minutes), 0 when never late. */
  averageLateMinutes: number;
  /** 0–1: share of records that were on time. Higher is better. */
  punctualityScore: number;
}

const round = (n: number, dp = 2): number => {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
};

const isAbsence = (s: StaffAttendanceStatus): boolean => s === 'ABSENT';
const isLate = (s: StaffAttendanceStatus): boolean => s === 'LATE';
const isPresent = (s: StaffAttendanceStatus): boolean =>
  s === 'PRESENT' || s === 'LATE' || s === 'EARLY_DEPARTURE' || s === 'REMOTE';

/** Bucket a row's date by day or month. */
export function bucketOf(date: string, granularity: 'day' | 'month'): string {
  return granularity === 'month' ? date.slice(0, 7) : date.slice(0, 10);
}

/** Absence / lateness / overtime trend over time. */
export function buildTrend(
  rows: readonly AnalyticsRow[],
  granularity: 'day' | 'month' = 'day',
): TrendPoint[] {
  const buckets = new Map<string, TrendPoint>();
  for (const row of rows) {
    const key = bucketOf(row.date, granularity);
    const point =
      buckets.get(key) ??
      ({
        bucket: key,
        present: 0,
        absent: 0,
        late: 0,
        onLeave: 0,
        totalRecords: 0,
        lateMinutes: 0,
        overtimeHours: 0,
        absenceRate: 0,
        latenessRate: 0,
      } satisfies TrendPoint);

    point.totalRecords += 1;
    if (isPresent(row.status)) point.present += 1;
    if (isAbsence(row.status)) point.absent += 1;
    if (isLate(row.status)) point.late += 1;
    if (row.status === 'ON_LEAVE') point.onLeave += 1;
    point.lateMinutes += row.lateMinutes;
    point.overtimeHours += row.overtimeHours;
    buckets.set(key, point);
  }

  return [...buckets.values()]
    .map((p) => ({
      ...p,
      overtimeHours: round(p.overtimeHours),
      absenceRate: p.totalRecords ? round(p.absent / p.totalRecords, 4) : 0,
      latenessRate: p.totalRecords ? round(p.late / p.totalRecords, 4) : 0,
    }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
}

/** Per-department heatmap input. */
export function buildDepartmentStats(rows: readonly AnalyticsRow[]): DepartmentStat[] {
  type DeptAccumulator = DepartmentStat & { employeeIds: Set<string> };
  const byDept = new Map<string, DeptAccumulator>();
  for (const row of rows) {
    const key = row.departmentId ?? '__none__';
    const fresh: DeptAccumulator = {
      departmentId: row.departmentId,
      departmentName: row.departmentName ?? 'Unassigned',
      employees: 0,
      records: 0,
      absences: 0,
      lates: 0,
      lateMinutes: 0,
      overtimeHours: 0,
      absenceRate: 0,
      latenessRate: 0,
      employeeIds: new Set<string>(),
    };
    const entry = byDept.get(key) ?? fresh;

    entry.employeeIds.add(row.employeeId);
    entry.records += 1;
    if (isAbsence(row.status)) entry.absences += 1;
    if (isLate(row.status)) entry.lates += 1;
    entry.lateMinutes += row.lateMinutes;
    entry.overtimeHours += row.overtimeHours;
    byDept.set(key, entry);
  }

  return [...byDept.values()]
    .map(({ employeeIds, ...d }) => ({
      ...d,
      employees: employeeIds.size,
      overtimeHours: round(d.overtimeHours),
      absenceRate: d.records ? round(d.absences / d.records, 4) : 0,
      latenessRate: d.records ? round(d.lates / d.records, 4) : 0,
    }))
    .sort((a, b) => b.absenceRate - a.absenceRate);
}

/** Per-employee punctuality, worst first (the actionable ordering). */
export function buildPunctuality(rows: readonly AnalyticsRow[]): PunctualityStat[] {
  const byEmployee = new Map<string, PunctualityStat>();
  for (const row of rows) {
    const entry =
      byEmployee.get(row.employeeId) ??
      ({
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        records: 0,
        lates: 0,
        lateMinutes: 0,
        averageLateMinutes: 0,
        punctualityScore: 1,
      } satisfies PunctualityStat);

    entry.records += 1;
    if (isLate(row.status)) entry.lates += 1;
    entry.lateMinutes += row.lateMinutes;
    byEmployee.set(row.employeeId, entry);
  }

  return [...byEmployee.values()]
    .map((e) => ({
      ...e,
      averageLateMinutes: e.lates ? round(e.lateMinutes / e.lates) : 0,
      punctualityScore: e.records ? round((e.records - e.lates) / e.records, 4) : 1,
    }))
    .sort((a, b) => a.punctualityScore - b.punctualityScore);
}

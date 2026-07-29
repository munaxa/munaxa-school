import { BadRequestException, Injectable } from '@nestjs/common';
import { AttendanceAnalyticsRepository } from './attendance-analytics.repository';
import {
  buildDepartmentStats,
  buildPunctuality,
  buildTrend,
  type DepartmentStat,
  type PunctualityStat,
  type TrendPoint,
} from './attendance-analytics.logic';
import type { ReportTable } from '../../../reporting/export/report.types';

export interface AnalyticsQuery {
  from: string;
  to: string;
  departmentId?: string;
  granularity?: 'day' | 'month';
}

export interface AttendanceAnalytics {
  from: string;
  to: string;
  granularity: 'day' | 'month';
  trend: TrendPoint[];
  departments: DepartmentStat[];
  punctuality: PunctualityStat[];
}

/**
 * Attendance analytics (PR-12).
 *
 * Extends the existing HR dashboard/reporting capability rather than introducing a competing
 * analytics stack: aggregation happens in pure reducers and results are emitted as generic
 * {@link ReportTable}s so the established {@link ExportService} handles csv/xlsx/pdf unchanged.
 */
@Injectable()
export class AttendanceAnalyticsService {
  constructor(private readonly repo: AttendanceAnalyticsRepository) {}

  async analytics(query: AnalyticsQuery): Promise<AttendanceAnalytics> {
    const from = parseDate(query.from);
    const to = parseDate(query.to);
    if (to < from) throw new BadRequestException('`to` must be on or after `from`');
    const granularity = query.granularity ?? 'day';

    const rows = await this.repo.rowsInRange(from, to, query.departmentId);
    return {
      from: query.from.slice(0, 10),
      to: query.to.slice(0, 10),
      granularity,
      trend: buildTrend(rows, granularity),
      departments: buildDepartmentStats(rows),
      punctuality: buildPunctuality(rows),
    };
  }

  /** Department heatmap as an export-ready table. */
  toDepartmentTable(result: AttendanceAnalytics): ReportTable {
    return {
      title: 'Attendance by department',
      subtitle: `${result.from} → ${result.to}`,
      columns: [
        { key: 'departmentName', header: 'Department' },
        { key: 'employees', header: 'Employees' },
        { key: 'records', header: 'Records' },
        { key: 'absences', header: 'Absences' },
        { key: 'absenceRate', header: 'Absence rate' },
        { key: 'lates', header: 'Late' },
        { key: 'latenessRate', header: 'Lateness rate' },
        { key: 'lateMinutes', header: 'Late minutes' },
        { key: 'overtimeHours', header: 'Overtime hours' },
      ],
      rows: result.departments.map((d) => ({ ...d, departmentId: d.departmentId ?? '' })),
      generatedAt: new Date().toISOString(),
    };
  }

  /** Punctuality ranking as an export-ready table. */
  toPunctualityTable(result: AttendanceAnalytics): ReportTable {
    return {
      title: 'Staff punctuality',
      subtitle: `${result.from} → ${result.to}`,
      columns: [
        { key: 'employeeName', header: 'Employee' },
        { key: 'records', header: 'Records' },
        { key: 'lates', header: 'Late' },
        { key: 'lateMinutes', header: 'Late minutes' },
        { key: 'averageLateMinutes', header: 'Avg late (min)' },
        { key: 'punctualityScore', header: 'Punctuality' },
      ],
      rows: result.punctuality.map((p) => ({ ...p })),
      generatedAt: new Date().toISOString(),
    };
  }
}

function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

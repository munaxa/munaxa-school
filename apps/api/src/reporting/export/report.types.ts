/** A generic tabular report: rendered as JSON for viewing and as CSV/Excel/PDF for export. */
export interface ReportColumn {
  key: string;
  header: string;
}

export interface ReportTable {
  title: string;
  /** Human-readable description of the applied filters (range, section, …). */
  subtitle?: string;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number>>;
  generatedAt: string;
}

export type ReportFormat = 'csv' | 'xlsx' | 'pdf';

export const REPORT_FORMATS: ReportFormat[] = ['csv', 'xlsx', 'pdf'];

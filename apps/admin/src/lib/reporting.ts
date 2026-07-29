'use client';

import { authFetch } from './auth';

export type ReportKind = 'attendance' | 'academic' | 'financial' | 'behavior';
export type ReportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ReportColumn {
  key: string;
  header: string;
}

export interface ReportTable {
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number>>;
  generatedAt: string;
}

export interface ReportFilters {
  sectionId?: string;
  from?: string;
  to?: string;
  semesterId?: string;
}

// Same-origin base; Next reverse-proxies /api/v1/* to the real API (see next.config.mjs).
const API_URL = '/api/v1';

function query(filters: ReportFilters): string {
  const params = new URLSearchParams();
  if (filters.sectionId) params.set('sectionId', filters.sectionId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.semesterId) params.set('semesterId', filters.semesterId);
  const s = params.toString();
  return s ? `?${s}` : '';
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const reportingApi = {
  view: (kind: ReportKind, filters: ReportFilters) =>
    authFetch(`/reports/${kind}${query(filters)}`).then((r) => json<ReportTable>(r)),

  /** Download an export via the cookie session, and trigger a browser save. */
  async download(kind: ReportKind, format: ReportFormat, filters: ReportFilters): Promise<void> {
    const params = new URLSearchParams(query(filters).replace(/^\?/, ''));
    params.set('format', format);
    const res = await fetch(`${API_URL}/reports/${kind}/export?${params.toString()}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error(`Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') ?? '';
    const match = /filename="([^"]+)"/.exec(disposition);
    const filename = match?.[1] ?? `${kind}-report.${format}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

'use client';

import { authFetch } from './auth';

export interface AttendanceRecord {
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
}

export interface AttendanceSummary {
  date: string;
  classNumber: number;
  counts: { PRESENT: number; ABSENT: number; LATE: number; EXCUSED: number };
  total: number;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export interface AttendanceMark {
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
}

export const attendanceApi = {
  list: (sectionId: string, date: string, classNumber: number) =>
    authFetch(
      `/attendance/students?sectionId=${sectionId}&date=${date}&classNumber=${classNumber}`,
    ).then((r) => json<AttendanceMark[]>(r)),
  mark: (sectionId: string, date: string, classNumber: number, records: AttendanceRecord[]) =>
    authFetch('/attendance/students/bulk', {
      method: 'POST',
      body: JSON.stringify({ sectionId, date, classNumber, records }),
    }).then((r) => json<{ marked: number }>(r)),
  summary: (sectionId: string, date: string, classNumber = 0) =>
    authFetch(
      `/attendance/students/summary?sectionId=${sectionId}&date=${date}&classNumber=${classNumber}`,
    ).then((r) => json<AttendanceSummary>(r)),
};

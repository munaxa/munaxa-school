'use client';

import { authFetch } from './auth';

/**
 * Admin API client for the Attendance evolution surfaces: policy thresholds, shift windows,
 * immutability locks, the correction workflow and analytics.
 *
 * Mirrors the existing `attendance.ts` client style — a thin typed wrapper over `authFetch` with no
 * business logic (rules live in the API services, never in the UI).
 */

export type StaffAttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'LATE'
  | 'EARLY_DEPARTURE'
  | 'ON_LEAVE'
  | 'HOLIDAY'
  | 'REMOTE';

export type LockScope = 'DAY' | 'WEEK' | 'PAYROLL' | 'SEMESTER';
export type LockStatus = 'ACTIVE' | 'RELEASED';
export type CorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'CANCELLED';
export type ShiftKind = 'MORNING' | 'EVENING' | 'SPLIT' | 'FLEXIBLE' | 'WEEKEND' | 'CUSTOM';

export interface AttendancePolicy {
  id: string;
  name: string;
  campusId: string | null;
  isDefault: boolean;
  graceMinutes: number;
  lateAfterMinutes: number;
  absentAfterMinutes: number;
  halfDayAfterShortfallMinutes: number;
  earlyDepartureAfterMinutes: number;
  overtimeAfterMinutes: number;
  countWeekendAsWorking: boolean;
  allowManualOverride: boolean;
  isActive: boolean;
}

export interface Shift {
  id: string;
  name: string;
  kind: ShiftKind;
  expectedCheckIn: string;
  expectedCheckOut: string;
  breakMinutes: number;
  maxHours: string | number | null;
  isActive: boolean;
}

export interface AttendanceLock {
  id: string;
  scope: LockScope;
  periodStart: string;
  periodEnd: string;
  status: LockStatus;
  reason: string | null;
  releaseNote: string | null;
  lockedAt: string;
  releasedAt: string | null;
}

export interface CorrectionRequest {
  id: string;
  employeeId: string;
  date: string;
  requestedStatus: StaffAttendanceStatus;
  previousStatus: StaffAttendanceStatus | null;
  reason: string;
  evidenceUrl: string | null;
  status: CorrectionStatus;
  currentLevel: number;
  requiredLevels: number;
  employee?: { firstNameEn: string; lastNameEn: string; employeeNumber: string | null };
}

export interface TrendPoint {
  bucket: string;
  present: number;
  absent: number;
  late: number;
  totalRecords: number;
  lateMinutes: number;
  overtimeHours: number;
  absenceRate: number;
  latenessRate: number;
}

export interface DepartmentStat {
  departmentId: string | null;
  departmentName: string;
  employees: number;
  records: number;
  absences: number;
  lates: number;
  absenceRate: number;
  latenessRate: number;
  overtimeHours: number;
}

export interface PunctualityStat {
  employeeId: string;
  employeeName: string;
  records: number;
  lates: number;
  lateMinutes: number;
  averageLateMinutes: number;
  punctualityScore: number;
}

export interface AttendanceAnalytics {
  from: string;
  to: string;
  granularity: 'day' | 'month';
  trend: TrendPoint[];
  departments: DepartmentStat[];
  punctuality: PunctualityStat[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  count: number;
}

export interface ValidatedPayroll {
  from: string;
  to: string;
  workingDays: number;
  rows: unknown[];
  validation: { valid: boolean; issues: ValidationIssue[]; warnings: ValidationIssue[] };
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const attendanceOpsApi = {
  // ----- Policy -----
  listPolicies: () => authFetch('/hr/attendance/policies').then((r) => json<AttendancePolicy[]>(r)),
  effectivePolicy: () =>
    authFetch('/hr/attendance/policies/effective').then((r) =>
      json<Omit<AttendancePolicy, 'id' | 'name' | 'campusId' | 'isDefault' | 'isActive'>>(r),
    ),
  createPolicy: (data: Partial<AttendancePolicy> & { name: string }) =>
    authFetch('/hr/attendance/policies', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<AttendancePolicy>(r),
    ),
  updatePolicy: (id: string, data: Partial<AttendancePolicy>) =>
    authFetch(`/hr/attendance/policies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => json<AttendancePolicy>(r)),

  // ----- Shifts -----
  listShifts: () => authFetch('/hr/shifts').then((r) => json<Shift[]>(r)),
  createShift: (data: {
    name: string;
    kind?: ShiftKind;
    expectedCheckIn: string;
    expectedCheckOut: string;
    breakMinutes?: number;
    maxHours?: number;
  }) =>
    authFetch('/hr/shifts', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<Shift>(r),
    ),
  assignShift: (
    employeeId: string,
    data: { shiftId: string; effectiveFrom: string; effectiveTo?: string },
  ) =>
    authFetch(`/employees/${employeeId}/shifts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<{ id: string }>(r)),

  // ----- Locks -----
  listLocks: (status?: LockStatus) =>
    authFetch(`/hr/attendance/locks${status ? `?status=${status}` : ''}`).then((r) =>
      json<AttendanceLock[]>(r),
    ),
  createLock: (data: {
    scope: LockScope;
    periodStart: string;
    periodEnd: string;
    reason?: string;
  }) =>
    authFetch('/hr/attendance/locks', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<AttendanceLock>(r),
    ),
  releaseLock: (id: string, note?: string) =>
    authFetch(`/hr/attendance/locks/${id}/release`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }).then((r) => json<AttendanceLock>(r)),

  // ----- Corrections -----
  listCorrections: (status?: CorrectionStatus) =>
    authFetch(`/hr/attendance/corrections${status ? `?status=${status}` : ''}`).then((r) =>
      json<CorrectionRequest[]>(r),
    ),
  approveCorrection: (id: string, note?: string) =>
    authFetch(`/hr/attendance/corrections/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }).then((r) => json<CorrectionRequest>(r)),
  rejectCorrection: (id: string, note?: string) =>
    authFetch(`/hr/attendance/corrections/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }).then((r) => json<CorrectionRequest>(r)),

  // ----- Analytics & payroll validation -----
  analytics: (from: string, to: string, granularity: 'day' | 'month' = 'day') =>
    authFetch(`/hr/attendance/analytics?from=${from}&to=${to}&granularity=${granularity}`).then(
      (r) => json<AttendanceAnalytics>(r),
    ),
  validatedPayroll: (from: string, to: string) =>
    authFetch(`/hr/payroll-prep/validated?from=${from}&to=${to}`).then((r) =>
      json<ValidatedPayroll>(r),
    ),
};

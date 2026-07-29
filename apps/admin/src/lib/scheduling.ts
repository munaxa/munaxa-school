'use client';

import { authFetch } from './auth';

// ─── Types (mirror the SchedulingService responses) ───────────────────────────

export type ScheduleType = 'REGULAR' | 'RAMADAN';
export type DayOfWeek = 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
export type PlanStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface Subject {
  id: string;
  nameEn: string;
  nameAr: string;
  code?: string | null;
  colorHex: string;
  isActive: boolean;
}

export interface SchedulePlan {
  id: string;
  semesterId: string;
  academicYearId: string;
  campusId: string;
  name: string;
  status: PlanStatus;
  publishedAt?: string | null;
  archivedAt?: string | null;
}

export interface Conflict {
  type:
    | 'TEACHER_DOUBLE_BOOKING'
    | 'SECTION_OVERLAP'
    | 'DUPLICATE_CLASS_NUMBER'
    | 'INVALID_SEQUENCE'
    | 'SUBJECT_DUPLICATION'
    | 'MISSING_TEACHER'
    | 'MISSING_SUBJECT'
    | 'INVALID_TIME';
  severity: 'ERROR' | 'WARNING';
  message: string;
  scheduleType: ScheduleType;
  dayOfWeek: DayOfWeek;
  classIds: string[];
}

export interface PlanValidation {
  conflicts: Conflict[];
  canPublish: boolean;
}

export interface PlanSectionSummary {
  id: string;
  sectionId: string;
  section: { name: string; grade: { nameEn: string; level: number } };
  _count: { classes: number };
}

export interface PlanOverview {
  plan: SchedulePlan;
  sections: PlanSectionSummary[];
  validation: PlanValidation;
}

export interface EditableClass {
  id: string;
  scheduleType: ScheduleType;
  dayOfWeek: DayOfWeek;
  classNumber: number;
  startTime: string;
  endTime: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  teacherId: string | null;
  teacherName: string | null;
  locationId: string | null;
  locationName: string | null;
}

export interface ClassInput {
  sectionId: string;
  scheduleType?: ScheduleType;
  dayOfWeek: DayOfWeek;
  classNumber: number;
  startTime: string;
  endTime: string;
  subjectId: string;
  teacherId?: string | null;
  locationId?: string | null;
}

// ─── Client ───────────────────────────────────────────────────────────────────

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
      conflicts?: Conflict[];
    };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    const err = new Error(message ?? `Request failed (${res.status})`) as Error & {
      conflicts?: Conflict[];
    };
    if (body.conflicts) err.conflicts = body.conflicts;
    throw err;
  }
  return (await res.json()) as T;
}

async function del(path: string): Promise<void> {
  const res = await authFetch(path, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(`Request failed (${res.status})`);
}

const post = <T>(path: string, body?: unknown) =>
  authFetch(path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => json<T>(r));

export const subjectsApi = {
  list: () => authFetch('/subjects').then((r) => json<Subject[]>(r)),
  create: (data: { nameEn: string; nameAr: string; code?: string; colorHex?: string }) =>
    post<Subject>('/subjects', data),
  update: (id: string, data: Partial<Subject>) =>
    authFetch(`/subjects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<Subject>(r),
    ),
  remove: (id: string) => del(`/subjects/${id}`),
};

export const plansApi = {
  list: (semesterId: string) =>
    authFetch(`/schedule/plans?semesterId=${encodeURIComponent(semesterId)}`).then((r) =>
      json<SchedulePlan[]>(r),
    ),
  overview: (id: string) => authFetch(`/schedule/plans/${id}`).then((r) => json<PlanOverview>(r)),
  validate: (id: string) =>
    authFetch(`/schedule/plans/${id}/validate`).then((r) => json<PlanValidation>(r)),
  sectionClasses: (id: string, sectionId: string) =>
    authFetch(`/schedule/plans/${id}/sections/${sectionId}/classes`).then((r) =>
      json<EditableClass[]>(r),
    ),
  create: (data: { semesterId: string; name: string }) =>
    post<SchedulePlan>('/schedule/plans', data),
  duplicate: (id: string, name: string) =>
    post<SchedulePlan>(`/schedule/plans/${id}/duplicate`, { name }),
  copySemester: (data: { sourceSemesterId: string; targetSemesterId: string; name: string }) =>
    post<SchedulePlan>('/schedule/plans/copy-semester', data),
  publish: (id: string) => post<SchedulePlan>(`/schedule/plans/${id}/publish`),
  archive: (id: string) => post<SchedulePlan>(`/schedule/plans/${id}/archive`),
  restore: (id: string) => post<SchedulePlan>(`/schedule/plans/${id}/restore`),
  remove: (id: string) => del(`/schedule/plans/${id}`),
  addClass: (id: string, data: ClassInput) =>
    post<EditableClass>(`/schedule/plans/${id}/classes`, data),
  updateClass: (id: string, classId: string, data: Partial<ClassInput>) =>
    authFetch(`/schedule/plans/${id}/classes/${classId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => json<EditableClass>(r)),
  deleteClass: (id: string, classId: string) => del(`/schedule/plans/${id}/classes/${classId}`),
  clearDay: (
    id: string,
    data: { sectionId: string; dayOfWeek: DayOfWeek; scheduleType?: ScheduleType },
  ) => post<{ removed: number }>(`/schedule/plans/${id}/clear-day`, data),
  clearSection: (id: string, sectionId: string) =>
    post<{ removed: number }>(`/schedule/plans/${id}/clear-section`, { sectionId }),
};

'use client';

import { authFetch } from './auth';

export interface School {
  id: string;
  nameEn: string;
  nameAr: string;
  moeSchoolCode?: string | null;
  isActive: boolean;
}

export interface Campus {
  id: string;
  schoolId: string;
  nameEn: string;
  nameAr: string;
  isMain: boolean;
}

export interface Section {
  id: string;
  gradeId: string;
  name: string;
  classroomId?: string | null;
  capacity?: number | null;
  /** Parent grade, included by the list endpoint so a section can be labelled unambiguously. */
  grade?: { id: string; nameEn: string; nameAr: string; level: number } | null;
}

export interface Grade {
  id: string;
  campusId: string;
  nameEn: string;
  nameAr: string;
  level: number;
}

export interface Classroom {
  id: string;
  campusId: string;
  name: string;
  capacity?: number | null;
  building?: string | null;
  floor?: string | null;
}

/** Lifecycle status. `UPCOMING` is surfaced in the UI as "Planned" (label-only mapping). */
export type AcademicYearStatus = 'UPCOMING' | 'ACTIVE' | 'CLOSED';

export interface AcademicYear {
  id: string;
  campusId: string;
  schoolId?: string | null;
  name: string;
  startDate: string;
  endDate: string;
  registrationStartDate?: string | null;
  registrationEndDate?: string | null;
  isCurrent: boolean;
  status: AcademicYearStatus;
}

/** Operational metrics for an Academic Year card (GET /academic-years/:id/overview). */
export interface AcademicYearOverview {
  academicYearId: string;
  studentCount: number;
  activeEnrollments: number;
  graduatingStudents: number;
  withdrawnStudents: number;
  classCount: number;
  gradeCount: number;
  semesterCount: number;
  outstandingFees: string;
  unverifiedPayments: number;
  attendancePct: number | null;
  reportCardCompletionPct: number | null;
  timetableCompletionPct: number | null;
}

export interface ReadinessCheck {
  key: string;
  label: string;
  ok: boolean;
  severity: 'blocker' | 'info';
  resolveRoute?: string;
}

/** Activation/close pre-flight + Academic Readiness Score (GET /academic-years/:id/readiness). */
export interface AcademicYearReadiness {
  academicYearId: string;
  score: number;
  activation: { canActivate: boolean; checks: ReadinessCheck[] };
  close: { canClose: boolean; checks: ReadinessCheck[] };
}

export interface AcademicYearDeletability {
  deletable: boolean;
  usage: {
    enrollments: number;
    charges: number;
    semesters: number;
    reports: number;
    timetable: number;
    auditLogs: number;
  };
}

export interface Semester {
  id: string;
  academicYearId: string;
  name: string;
  sequence: number;
  startDate: string;
  endDate: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const schoolsApi = {
  list: () => authFetch('/schools').then((r) => json<School[]>(r)),
  create: (data: { nameEn: string; nameAr: string; moeSchoolCode?: string }) =>
    authFetch('/schools', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<School>(r),
    ),
  remove: (id: string) => authFetch(`/schools/${id}`, { method: 'DELETE' }).then(() => undefined),
};

export const campusesApi = {
  list: (schoolId: string) =>
    authFetch(`/campuses?schoolId=${encodeURIComponent(schoolId)}`).then((r) => json<Campus[]>(r)),
  create: (data: { schoolId: string; nameEn: string; nameAr: string; isMain?: boolean }) =>
    authFetch('/campuses', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<Campus>(r),
    ),
  remove: (id: string) => authFetch(`/campuses/${id}`, { method: 'DELETE' }).then(() => undefined),
};

async function del(path: string): Promise<void> {
  const res = await authFetch(path, { method: 'DELETE' });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
}

export const sectionsApi = {
  list: (gradeId?: string) =>
    authFetch(`/sections${gradeId ? `?gradeId=${encodeURIComponent(gradeId)}` : ''}`).then((r) =>
      json<Section[]>(r),
    ),
  create: (data: { gradeId: string; name: string; capacity?: number }) =>
    authFetch('/sections', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<Section>(r),
    ),
  remove: (id: string) => del(`/sections/${id}`),
};

export const gradesApi = {
  list: (campusId: string) =>
    authFetch(`/grades?campusId=${encodeURIComponent(campusId)}`).then((r) => json<Grade[]>(r)),
  create: (data: { campusId: string; nameEn: string; nameAr: string; level: number }) =>
    authFetch('/grades', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<Grade>(r),
    ),
  remove: (id: string) => del(`/grades/${id}`),
};

export const classroomsApi = {
  list: (campusId: string) =>
    authFetch(`/classrooms?campusId=${encodeURIComponent(campusId)}`).then((r) =>
      json<Classroom[]>(r),
    ),
  create: (data: {
    campusId: string;
    name: string;
    capacity?: number;
    building?: string;
    floor?: string;
  }) =>
    authFetch('/classrooms', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<Classroom>(r),
    ),
  remove: (id: string) => del(`/classrooms/${id}`),
};

export const academicYearsApi = {
  list: (campusId: string) =>
    authFetch(`/academic-years?campusId=${encodeURIComponent(campusId)}`).then((r) =>
      json<AcademicYear[]>(r),
    ),
  get: (id: string) => authFetch(`/academic-years/${id}`).then((r) => json<AcademicYear>(r)),
  current: (schoolId?: string) =>
    authFetch(
      `/academic-years/current${schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : ''}`,
    ).then((r) => json<AcademicYear | null>(r)),
  overview: (id: string) =>
    authFetch(`/academic-years/${id}/overview`).then((r) => json<AcademicYearOverview>(r)),
  readiness: (id: string) =>
    authFetch(`/academic-years/${id}/readiness`).then((r) => json<AcademicYearReadiness>(r)),
  deletable: (id: string) =>
    authFetch(`/academic-years/${id}/deletable`).then((r) => json<AcademicYearDeletability>(r)),
  create: (data: {
    campusId: string;
    name: string;
    startDate: string;
    endDate: string;
    registrationStartDate?: string | null;
    registrationEndDate?: string | null;
    status?: AcademicYearStatus;
    isCurrent?: boolean;
  }) =>
    authFetch('/academic-years', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<AcademicYear>(r),
    ),
  // Change the lifecycle status or edit dates. Setting ACTIVE makes this the current year and
  // auto-supersedes the previously-active year (one ACTIVE per school is enforced server-side).
  update: (
    id: string,
    data: Partial<{
      name: string;
      startDate: string;
      endDate: string;
      registrationStartDate: string | null;
      registrationEndDate: string | null;
      status: AcademicYearStatus;
    }>,
  ) =>
    authFetch(`/academic-years/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<AcademicYear>(r),
    ),
  /** Administrative config change: make this year the current (ACTIVE) one. Does NOT touch students. */
  setCurrent: (id: string) =>
    authFetch(`/academic-years/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'ACTIVE' }),
    }).then((r) => json<AcademicYear>(r)),
  /** Backward-compatible alias for {@link setCurrent}. */
  makeCurrent: (id: string) =>
    authFetch(`/academic-years/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'ACTIVE' }),
    }).then((r) => json<AcademicYear>(r)),
  /** Launch-point for the guided close (the wizard runs readiness first, then confirms). */
  close: (id: string) =>
    authFetch(`/academic-years/${id}/close`, { method: 'POST' }).then((r) => json<AcademicYear>(r)),
  remove: (id: string) => del(`/academic-years/${id}`),
};

export const semestersApi = {
  list: (academicYearId: string) =>
    authFetch(`/semesters?academicYearId=${encodeURIComponent(academicYearId)}`).then((r) =>
      json<Semester[]>(r),
    ),
  create: (data: {
    academicYearId: string;
    name: string;
    sequence: number;
    startDate: string;
    endDate: string;
  }) =>
    authFetch('/semesters', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<Semester>(r),
    ),
  update: (
    id: string,
    data: Partial<{ name: string; sequence: number; startDate: string; endDate: string }>,
  ) =>
    authFetch(`/semesters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<Semester>(r),
    ),
  remove: (id: string) => del(`/semesters/${id}`),
};

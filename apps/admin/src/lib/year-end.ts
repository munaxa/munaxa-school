'use client';

import { authFetch } from './auth';

export type YearEndAction = 'PROMOTE' | 'REPEAT' | 'GRADUATE' | 'WITHDRAW' | 'DECIDE_LATER';
export type YearEndProcessStatus = 'OPEN' | 'COMMITTED' | 'CANCELLED';

export interface YearEndProcess {
  id: string;
  schoolId: string;
  sourceAcademicYearId: string;
  targetAcademicYearId: string;
  status: YearEndProcessStatus;
  committedAt: string | null;
}

export interface YearEndDecision {
  id: string;
  studentId: string;
  sourceEnrollmentId: string;
  action: YearEndAction;
  targetGradeId: string | null;
  targetSectionId: string | null;
  targetClassroomId: string | null;
  reason: string | null;
  needsReview: boolean;
  reviewNote: string | null;
  resultingEnrollmentId: string | null;
  committedAt: string | null;
  student: {
    id: string;
    studentNumber: string | null;
    firstNameEn: string;
    lastNameEn: string;
  } | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const yearEndApi = {
  open: (req: { sourceAcademicYearId: string; targetAcademicYearId: string }) =>
    authFetch('/year-end/processes', { method: 'POST', body: JSON.stringify(req) }).then((r) =>
      json<YearEndProcess>(r),
    ),
  review: (processId: string) =>
    authFetch(`/year-end/processes/${processId}`).then((r) =>
      json<{ process: YearEndProcess; decisions: YearEndDecision[] }>(r),
    ),
  setDecision: (
    decisionId: string,
    req: {
      action: YearEndAction;
      targetGradeId?: string;
      targetSectionId?: string;
      targetClassroomId?: string;
      reason?: string;
    },
  ) =>
    authFetch(`/year-end/decisions/${decisionId}`, {
      method: 'PATCH',
      body: JSON.stringify(req),
    }).then((r) => json<YearEndDecision>(r)),
  commit: (processId: string) =>
    authFetch(`/year-end/processes/${processId}/commit`, { method: 'POST' }).then((r) =>
      json<{
        processId: string;
        promoted: number;
        graduated: number;
        withdrawn: number;
        skipped: number;
        failed: number;
      }>(r),
    ),
  cancel: (processId: string) =>
    authFetch(`/year-end/processes/${processId}/cancel`, { method: 'POST' }).then((r) =>
      json<YearEndProcess>(r),
    ),
};

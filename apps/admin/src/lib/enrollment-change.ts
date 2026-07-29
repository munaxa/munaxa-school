'use client';

import { authFetch } from './auth';

export interface FeeComparison {
  previousGradeName: string | null;
  newGradeName: string | null;
  currentTuition: string;
  newTuition: string;
  difference: string;
  additionalAmount: string;
  creditAmount: string;
  registrationAmount: string;
  paidChargesAffected: number;
  unpaidChargesToReplace: number;
  chargesUnchanged: number;
  existingCharges: Array<{
    description: string;
    amount: string;
    paid: boolean;
    willReplace: boolean;
  }>;
  newCharges: Array<{ description: string; amount: string }>;
  currentTotal: string;
  newTotal: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/**
 * Reason-first enrollment placement changes (PR 1 — no ledger changes). Grade/section/classroom live
 * on the Enrollment, never the Student. Promotion/Repeat are Year-End Processing operations.
 */
export const enrollmentChangeApi = {
  // Administrative transfer — different section within the SAME grade.
  transfer: (enrollmentId: string, req: { sectionId: string; reason?: string }) =>
    authFetch(`/enrollments/${enrollmentId}/transfer`, {
      method: 'PATCH',
      body: JSON.stringify(req),
    }).then((r) => json<{ enrollmentId: string; transferred: boolean }>(r)),

  // Data-entry grade correction on the current enrollment (warns about fees; no ledger change in PR 1).
  correctGrade: (
    enrollmentId: string,
    req: { gradeId: string; sectionId?: string; reason?: string },
  ) =>
    authFetch(`/enrollments/${enrollmentId}/correct-grade`, {
      method: 'PATCH',
      body: JSON.stringify(req),
    }).then((r) =>
      json<{
        enrollmentId: string;
        corrected: boolean;
        feesMayChange: boolean;
        feeWarning: string | null;
      }>(r),
    ),

  // PR 2 — read-only fee impact of the enrollment's current grade vs. what is billed. Nothing changes.
  feeComparison: (enrollmentId: string) =>
    authFetch(`/enrollments/${enrollmentId}/fee-comparison`).then((r) => json<FeeComparison>(r)),

  // PR 2 — explicit recalculation (only after the admin chose it). Never touches paid charges.
  recalculateFees: (enrollmentId: string) =>
    authFetch(`/enrollments/${enrollmentId}/recalculate-fees`, { method: 'POST' }).then((r) =>
      json<{ cancelledChargeIds: string[]; newChargeId: string | null; newTuition: string }>(r),
    ),
};

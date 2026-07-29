'use client';

import { authFetch } from './auth';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const enrollmentExitApi = {
  // Withdraw an active student: academic event + financial settlement (never deletes history).
  withdraw: (
    enrollmentId: string,
    req: { reason?: string; cancelUnpaidCharges?: boolean; keepRegistrationFee?: boolean } = {},
  ) =>
    authFetch(`/enrollments/${enrollmentId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify(req),
    }).then((r) =>
      json<{ enrollmentId: string; withdrawn: boolean; cancelledChargeIds: string[] }>(r),
    ),

  // Cancel a pre-active admission (void charges). Refused once anything is paid — withdraw instead.
  cancelAdmission: (enrollmentId: string, req: { reason?: string } = {}) =>
    authFetch(`/enrollments/${enrollmentId}/cancel-admission`, {
      method: 'POST',
      body: JSON.stringify(req),
    }).then((r) =>
      json<{ enrollmentId: string; cancelled: boolean; voidedChargeIds: string[] }>(r),
    ),

  // Reactivate a withdrawn enrollment (→ ACTIVE) and re-open the charges the withdrawal cancelled.
  reactivate: (enrollmentId: string, req: { reason?: string; reopenCharges?: boolean } = {}) =>
    authFetch(`/enrollments/${enrollmentId}/reactivate`, {
      method: 'POST',
      body: JSON.stringify(req),
    }).then((r) =>
      json<{ enrollmentId: string; reactivated: boolean; reopenedChargeIds: string[] }>(r),
    ),
};

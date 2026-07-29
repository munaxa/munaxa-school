'use client';

import { authFetch } from './auth';

export type CardType = 'NFC' | 'RFID';
export type CardStatus = 'ACTIVE' | 'SUSPENDED' | 'STOLEN' | 'LOST' | 'REVOKED';

export interface StudentCard {
  id: string;
  studentId: string;
  cardUid: string;
  type: CardType;
  status: CardStatus;
  label: string | null;
  issuedAt: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const cardsApi = {
  list: (studentId: string) =>
    authFetch(`/cards?studentId=${studentId}`).then((r) => json<StudentCard[]>(r)),
  issue: (data: { studentId: string; cardUid: string; type?: CardType; label?: string }) =>
    authFetch('/cards', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<StudentCard>(r),
    ),
  update: (id: string, data: { status?: CardStatus; label?: string }) =>
    authFetch(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<StudentCard>(r),
    ),
  remove: (id: string) =>
    authFetch(`/cards/${id}`, { method: 'DELETE' }).then((r) => json<{ deleted: true }>(r)),
};

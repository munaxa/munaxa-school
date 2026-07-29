'use client';

import { authFetch } from './auth';

export type PresenceEventType = 'GATE_IN' | 'GATE_OUT' | 'RECEPTION_CHECKIN' | 'RECEPTION_CHECKOUT';

export type PresenceMethod = 'NFC' | 'RFID' | 'QR' | 'MANUAL' | 'FACE' | 'BUS';

export const PRESENCE_EVENT_TYPES: PresenceEventType[] = [
  'GATE_IN',
  'GATE_OUT',
  'RECEPTION_CHECKIN',
  'RECEPTION_CHECKOUT',
];

export const PRESENCE_METHODS: PresenceMethod[] = ['MANUAL', 'NFC', 'RFID', 'QR', 'FACE', 'BUS'];

export interface PresenceEvent {
  id: string;
  studentId: string;
  eventType: PresenceEventType;
  method: PresenceMethod;
  occurredAt: string;
  deviceId?: string | null;
}

export interface CreatePresenceInput {
  studentId?: string;
  cardUid?: string;
  eventType: PresenceEventType;
  method?: PresenceMethod;
  occurredAt?: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const presenceApi = {
  listEvents: (studentId?: string, take = 100) => {
    const params = new URLSearchParams();
    if (studentId) params.set('studentId', studentId);
    params.set('take', String(take));
    return authFetch(`/presence/events?${params.toString()}`).then((r) => json<PresenceEvent[]>(r));
  },
  createEvent: (data: CreatePresenceInput) =>
    authFetch('/presence/events', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<PresenceEvent>(r),
    ),
};

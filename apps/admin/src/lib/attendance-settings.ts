'use client';

import { authFetch } from './auth';

export type AttendanceSourceMode = 'TEACHER_ONLY' | 'GATE_ARRIVAL' | 'BUS_ARRIVAL' | 'HYBRID';
export type TransportMethod = 'NFC' | 'RFID' | 'QR' | 'MANUAL';

export interface AttendanceSettings {
  mode: AttendanceSourceMode;
  busMethod: TransportMethod;
  presenceEnabled: boolean;
  transportEnabled: boolean;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const attendanceSettingsApi = {
  get: () => authFetch('/attendance/settings').then((r) => json<AttendanceSettings>(r)),
  update: (data: Partial<AttendanceSettings>) =>
    authFetch('/attendance/settings', { method: 'PUT', body: JSON.stringify(data) }).then((r) =>
      json<AttendanceSettings>(r),
    ),
};

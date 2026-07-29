'use client';

import { authFetch } from './auth';

export interface Announcement {
  id: string;
  title: string;
  audience: string;
  createdAt: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const communicationApi = {
  listAnnouncements: () => authFetch('/announcements').then((r) => json<Announcement[]>(r)),
  publish: (data: { title: string; body: string; audience: string; sectionId?: string }) =>
    authFetch('/announcements', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<Announcement & { recipients: number }>(r),
    ),
  setFlag: (key: string, enabled: boolean) =>
    authFetch(`/feature-flags/${key}`, { method: 'PUT', body: JSON.stringify({ enabled }) }).then(
      (r) => json(r),
    ),
};

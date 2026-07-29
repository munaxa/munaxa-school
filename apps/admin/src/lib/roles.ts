'use client';

import { authFetch } from './auth';

export interface RoleSummary {
  id: string;
  key: string;
  isSystem: boolean;
  nameEn: string | null;
  nameAr: string | null;
  permissions: string[];
  userCount: number;
}

export interface PermissionCatalogEntry {
  key: string;
  category: string;
  description: string | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const rolesApi = {
  list: () => authFetch('/roles').then((r) => json<RoleSummary[]>(r)),
  catalog: () => authFetch('/roles/catalog').then((r) => json<PermissionCatalogEntry[]>(r)),
  create: (data: { nameEn: string; nameAr?: string; permissions: string[] }) =>
    authFetch('/roles', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<RoleSummary>(r),
    ),
  update: (id: string, data: { nameEn?: string; nameAr?: string; permissions?: string[] }) =>
    authFetch(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<RoleSummary>(r),
    ),
  remove: (id: string) => authFetch(`/roles/${id}`, { method: 'DELETE' }).then(() => undefined),
};

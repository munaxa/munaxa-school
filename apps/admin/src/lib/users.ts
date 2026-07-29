'use client';

import { authFetch } from './auth';

export type UserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

export interface UserSummary {
  id: string;
  email: string;
  username: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
  firstNameAr: string | null;
  lastNameAr: string | null;
  phone: string | null;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  roles: Array<{ id: string; key: string; nameEn: string | null }>;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const usersApi = {
  list: () => authFetch('/users').then((r) => json<UserSummary[]>(r)),
  create: (data: {
    email: string;
    username?: string;
    firstNameEn?: string;
    lastNameEn?: string;
    firstNameAr?: string;
    lastNameAr?: string;
    phone?: string;
    roleIds: string[];
  }) =>
    authFetch('/users', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<{ user: UserSummary; temporaryPassword: string; emailed: boolean }>(r),
    ),
  update: (
    id: string,
    data: {
      email?: string;
      username?: string;
      firstNameEn?: string;
      lastNameEn?: string;
      firstNameAr?: string;
      lastNameAr?: string;
      phone?: string;
      status?: UserStatus;
    },
  ) =>
    authFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<UserSummary>(r),
    ),
  setRoles: (id: string, roleIds: string[]) =>
    authFetch(`/users/${id}/roles`, { method: 'PUT', body: JSON.stringify({ roleIds }) }).then(
      (r) => json<UserSummary>(r),
    ),
  resetPassword: (id: string) =>
    authFetch(`/users/${id}/reset-password`, { method: 'POST' }).then((r) =>
      json<{ temporaryPassword: string; emailed: boolean }>(r),
    ),
};

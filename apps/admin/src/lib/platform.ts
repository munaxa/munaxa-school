'use client';

import { authFetch } from './auth';

export type TenantDbStatus =
  | 'REQUESTED'
  | 'PROVISIONED'
  | 'MIGRATED'
  | 'DATA_COPIED'
  | 'VERIFIED'
  | 'ACTIVE'
  | 'FAILED'
  | 'ABORTED';

export interface PromotionStep {
  key: TenantDbStatus;
  help: string;
  done: boolean;
  current: boolean;
}

export interface Promotion {
  tenantId: string;
  status: TenantDbStatus;
  connectionRef: string | null;
  hostLabel: string | null;
  note: string | null;
  lastError: string | null;
  activatedAt: string | null;
  updatedAt: string;
  steps: PromotionStep[];
  nextStep: TenantDbStatus | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

const base = '/platform/tenant-databases';

export const platformApi = {
  listDatabases: () => authFetch(base).then((r) => json<Promotion[]>(r)),

  startPromotion: (data: {
    tenantId: string;
    hostLabel?: string;
    connectionRef?: string;
    note?: string;
  }) =>
    authFetch(base, { method: 'POST', body: JSON.stringify(data) }).then((r) => json<Promotion>(r)),

  advance: (tenantId: string, to: TenantDbStatus, note?: string) =>
    authFetch(`${base}/${tenantId}/advance`, {
      method: 'POST',
      body: JSON.stringify({ to, ...(note ? { note } : {}) }),
    }).then((r) => json<Promotion>(r)),
};

'use client';

import { authFetch } from './auth';

/** Geographic area master data (home area + Area → Route mapping). */
export interface Area {
  id: string;
  name: string;
  /** The route that serves this area (Area → Route). Null until the dept maps it. */
  routeId: string | null;
  academicYearId: string | null;
  /** Optional fee override (JOD as string); null means use the route's TransportFare. */
  transportFee: string | null;
  transportationAvailable: boolean;
  active: boolean;
  notes: string | null;
  /** Enriched by the list endpoint. */
  route?: { id: string; name: string; disabledAt: string | null } | null;
  studentCount?: number;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const areasApi = {
  /** List areas. Pass filters to surface only the ones registration should offer. */
  list: (filter?: { active?: boolean; transportAvailable?: boolean }) => {
    const qs = new URLSearchParams();
    if (filter?.active !== undefined) qs.set('active', String(filter.active));
    if (filter?.transportAvailable !== undefined)
      qs.set('transportAvailable', String(filter.transportAvailable));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return authFetch(`/areas${suffix}`).then((r) => json<Area[]>(r));
  },
  create: (data: {
    name: string;
    routeId?: string;
    academicYearId?: string;
    transportFee?: number;
    transportationAvailable?: boolean;
    active?: boolean;
    notes?: string;
  }) =>
    authFetch('/areas', { method: 'POST', body: JSON.stringify(data) }).then((r) => json<Area>(r)),
  update: (
    id: string,
    data: Partial<{
      name: string;
      routeId: string;
      academicYearId: string;
      transportFee: number;
      transportationAvailable: boolean;
      active: boolean;
      notes: string;
    }>,
  ) =>
    authFetch(`/areas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<Area>(r),
    ),
};

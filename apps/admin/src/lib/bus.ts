'use client';

import { authFetch } from './auth';

export interface BusRoute {
  id: string;
  name: string;
  description: string | null;
  academicYearId: string | null;
  round1Time: string | null;
  round2Time: string | null;
  /** When set, the route is disabled (still listed; shown as disabled in fee config). */
  disabledAt: string | null;
}

export interface BusStop {
  id: string;
  routeId: string;
  name: string;
  sequence: number;
  lat: number | null;
  lng: number | null;
  pickupTime: string | null;
}

/** The driver assigned to a bus — a canonical Employee (HR Phase 3). */
export interface BusDriver {
  id: string;
  firstNameEn: string;
  lastNameEn: string;
  personalPhone: string | null;
}

export interface Bus {
  id: string;
  plateNumber: string;
  routeId: string | null;
  label: string | null;
  capacity: number | null;
  /** Which trip of the route this bus serves: 1 (1st) or 2 (2nd). */
  tripRound: number | null;
  driverId: string | null;
  driver: BusDriver | null;
  lastLat?: number | null;
  lastLng?: number | null;
}

/** Full name of a bus driver, or null when unassigned. */
export function busDriverName(bus: Pick<Bus, 'driver'>): string | null {
  return bus.driver ? `${bus.driver.firstNameEn} ${bus.driver.lastNameEn}`.trim() : null;
}

export interface StudentBusAssignment {
  id: string;
  studentId: string;
  routeId: string;
  stopId: string | null;
  /** Which trip of the route the student rides: 1 (1st), 2 (2nd), or 3 (both). */
  tripRound: number | null;
  /** ISO timestamp the assignment was created (returned by the API). */
  createdAt?: string | null;
}

export interface StudentTransport {
  routeName: string;
  /** Which trip of the route the student rides: 1 (1st) or 2 (2nd). */
  tripRound: number | null;
  busNumber: string | null;
  busPlate: string | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const busApi = {
  listRoutes: (academicYearId?: string) =>
    authFetch(
      `/bus/routes${academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : ''}`,
    ).then((r) => json<BusRoute[]>(r)),
  createRoute: (data: {
    name: string;
    description?: string;
    academicYearId?: string;
    round1Time?: string;
    round2Time?: string;
  }) =>
    authFetch('/bus/routes', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<BusRoute>(r),
    ),
  updateRoute: (
    id: string,
    data: Partial<{
      name: string;
      description: string;
      academicYearId: string | null;
      round1Time: string;
      round2Time: string;
      disabled: boolean;
    }>,
  ) =>
    authFetch(`/bus/routes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<BusRoute>(r),
    ),

  listStops: (routeId: string) =>
    authFetch(`/bus/routes/${routeId}/stops`).then((r) => json<BusStop[]>(r)),
  createStop: (data: {
    routeId: string;
    name: string;
    sequence?: number;
    pickupTime?: string;
    lat?: number;
    lng?: number;
  }) =>
    authFetch('/bus/routes/stops', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<BusStop>(r),
    ),

  listBuses: () => authFetch('/bus/vehicles').then((r) => json<Bus[]>(r)),
  createBus: (data: {
    plateNumber: string;
    routeId?: string;
    label?: string;
    capacity?: number;
    tripRound?: number;
    driverId?: string;
  }) =>
    authFetch('/bus/vehicles', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<Bus>(r),
    ),
  updateBus: (
    id: string,
    data: Partial<{
      plateNumber: string;
      routeId: string | null;
      label: string;
      capacity: number;
      tripRound: number | null;
      driverId: string | null;
    }>,
  ) =>
    authFetch(`/bus/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<Bus>(r),
    ),

  listAssignments: (routeId?: string) =>
    authFetch(`/bus/assignments${routeId ? `?routeId=${routeId}` : ''}`).then((r) =>
      json<StudentBusAssignment[]>(r),
    ),
  assign: (data: { studentId: string; routeId: string; stopId?: string; tripRound?: number }) =>
    authFetch('/bus/assignments', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<StudentBusAssignment>(r),
    ),
  unassign: (id: string) =>
    authFetch(`/bus/assignments/${id}`, { method: 'DELETE' }).then(() => undefined),
  studentTransport: (studentId: string) =>
    authFetch(`/bus/students/${studentId}/transport`).then((r) => json<StudentTransport | null>(r)),
};

// ---------------------------------------------------------------------------
// Drivers (HR Phase 3) — drivers are Employees with a driver profile.
// ---------------------------------------------------------------------------

export interface DriverListRow {
  id: string; // driver profile id
  employeeId: string;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  medicalCertExpiry: string | null;
  performanceRating: number | null;
  employee: {
    id: string;
    firstNameEn: string;
    lastNameEn: string;
    personalPhone: string | null;
    status: string;
  };
  buses: Array<{ id: string; plateNumber: string; label: string | null }>;
}

export const driversApi = {
  list: () => authFetch('/drivers').then((r) => json<DriverListRow[]>(r)),
};

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { studentsApi, fullNameEn, fullNameAr, type Student } from '@/lib/people';
import {
  busApi,
  busDriverName,
  type Bus,
  type BusRoute,
  type BusStop,
  type StudentBusAssignment,
} from '@/lib/bus';
import {
  schoolsApi,
  campusesApi,
  academicYearsApi,
  sectionsApi,
  type AcademicYear,
  type Section,
} from '@/lib/structure';
import { areasApi, type Area } from '@/lib/areas';

/** Debounce a fast-changing value (e.g. a search box) for cheaper filtering. */
export function useDebouncedValue<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/** Map a UI trip value to the API payload's tripRound (undefined = No trip). */
export function tripToRound(trip: TripValue): number | undefined {
  return trip === '' ? undefined : Number(trip);
}

export interface BulkOutcome {
  ok: number;
  failed: number;
}

/**
 * Run a per-id async action sequentially (keeps the server + audit log calm) and
 * report a summary. Capacity never blocks here — every id is attempted.
 */
export async function runBulk<T>(ids: T[], action: (id: T) => Promise<void>): Promise<BulkOutcome> {
  let ok = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      await action(id);
      ok += 1;
    } catch {
      failed += 1;
    }
  }
  return { ok, failed };
}

/** Multi-select state for the selectable tables + bulk action bar. */
export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = useCallback(
    (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const toggleVisible = useCallback(
    (ids: string[], checked: boolean) =>
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      }),
    [],
  );
  const clear = useCallback(() => setSelected(new Set()), []);
  return { selected, setSelected, toggle, toggleVisible, clear };
}

/** Trigger a client-side CSV download for the given student rows. */
export function exportRowsCsv(rows: StudentRow[], filename: string): void {
  const header = ['Student ID', 'Name', 'Grade', 'Area', 'Pickup Point', 'Route', 'Trip'];
  const tripText = (n: number | null | undefined) =>
    n === 1 ? '1st Trip' : n === 2 ? '2nd Trip' : n === 3 ? 'Both Trips' : 'No Trip';
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [header.map(escape).join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.student.moeStudentNumber || r.student.qrCode,
        r.name,
        r.grade ?? '',
        r.area,
        r.pickup ?? '',
        r.routeName ?? '',
        tripText(r.assignment?.tripRound),
      ]
        .map((v) => escape(String(v)))
        .join(','),
    );
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Trip vocabulary — single source of truth.
// Persisted as `tripRound`: null/0 = No trip, 1 = 1st, 2 = 2nd, 3 = Both.
// (3/Both is a Phase‑2 backend value; the UI treats it as a first‑class label
// and filter today. See TRANSPORTATION_REDESIGN.md §8.)
// ---------------------------------------------------------------------------
export type TripValue = '' | '1' | '2' | '3';

export const TRIP_OPTIONS: ReadonlyArray<{ value: TripValue; key: string }> = [
  { value: '', key: 'transport.trip.none' },
  { value: '1', key: 'transport.trip.first' },
  { value: '2', key: 'transport.trip.second' },
  { value: '3', key: 'transport.trip.both' },
];

/** i18n key for a stored tripRound. */
export function tripKey(round: number | null | undefined): string {
  switch (round) {
    case 1:
      return 'transport.trip.first';
    case 2:
      return 'transport.trip.second';
    case 3:
      return 'transport.trip.both';
    default:
      return 'transport.trip.none';
  }
}

/** Does a stored tripRound satisfy a trip filter value? */
export function tripMatches(round: number | null | undefined, filter: TripValue): boolean {
  if (filter === '') return round == null;
  if (filter === '1') return round === 1 || round === 3;
  if (filter === '2') return round === 2 || round === 3;
  if (filter === '3') return round === 3;
  return true;
}

// ---------------------------------------------------------------------------
// Capacity — visual status only. NEVER blocks assignment.
// ---------------------------------------------------------------------------
export type CapacityState = 'normal' | 'near' | 'exceeded' | 'unset';

export interface Capacity {
  capacity: number;
  assigned: number;
  available: number;
  exceeded: number;
  state: CapacityState;
  /** 0–100 fill for the occupancy bar (clamped). */
  percent: number;
}

export function capacityStatus(capacity: number, assigned: number): Capacity {
  const available = Math.max(capacity - assigned, 0);
  const exceeded = Math.max(assigned - capacity, 0);
  let state: CapacityState;
  if (capacity <= 0) state = 'unset';
  else if (assigned > capacity) state = 'exceeded';
  else if (assigned === capacity) state = 'near';
  else state = 'normal';
  const percent = capacity > 0 ? Math.min(Math.round((assigned / capacity) * 100), 100) : 0;
  return { capacity, assigned, available, exceeded, state, percent };
}

// ---------------------------------------------------------------------------
// Areas — geographic buckets backed by REAL data: the Area master list +
// Student.areaId (set at registration). A route's area is inferred from where its
// assigned riders actually live (the most common areaId), not from its name.
// ---------------------------------------------------------------------------
export const UNZONED = 'Unzoned';

/** The most frequent value in a list (ties broken by first seen), or null when empty. */
function mode<T>(values: T[]): T | null {
  const counts = new Map<T, number>();
  let best: T | null = null;
  let bestN = 0;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      bestN = n;
      best = v;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Derived view models
// ---------------------------------------------------------------------------
export interface RouteVM {
  route: BusRoute;
  area: string;
  buses: Bus[];
  busLabel: string | null;
  driverName: string | null;
  capacity: Capacity;
  trip1: number;
  trip2: number;
}

export interface StudentRow {
  student: Student;
  name: string;
  nameAr: string;
  grade: string | null;
  area: string;
  areaId: string | null;
  /** Parent requested transport at registration (drives the Unassigned queue). */
  transportRequested: boolean;
  pickup: string | null;
  assignment: StudentBusAssignment | null;
  routeName: string | null;
  assignedAt: string | null;
}

export interface AreaVM {
  /** Area master id (null for the synthetic "Unzoned" bucket). */
  id: string | null;
  name: string;
  routes: RouteVM[];
  /** Students whose home area is this and who requested transport (assigned or not). */
  needCount: number;
  assignedCount: number;
  capacity: number;
}

/** Shared transport data + optimistic mutators, loaded once per workspace mount. */
export interface TransportData {
  loading: boolean;
  error: string | null;
  unavailable: boolean;
  routes: BusRoute[];
  buses: Bus[];
  students: Student[];
  years: AcademicYear[];
  sections: Section[];
  /** Area master data (all non-deleted areas), used for naming + Setup management. */
  areaMaster: Area[];
  stopsByRoute: Record<string, BusStop[]>;
  assignments: StudentBusAssignment[];
  routeVMs: RouteVM[];
  areas: AreaVM[];
  rows: StudentRow[];
  reload: () => Promise<void>;
  /** Apply assignments locally after a successful API call (optimistic merge). */
  mergeAssignment: (a: StudentBusAssignment) => void;
  removeAssignment: (id: string) => void;
  setRoutes: React.Dispatch<React.SetStateAction<BusRoute[]>>;
  setBuses: React.Dispatch<React.SetStateAction<Bus[]>>;
  setAreaMaster: React.Dispatch<React.SetStateAction<Area[]>>;
}

export function useTransport(): TransportData {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [assignments, setAssignments] = useState<StudentBusAssignment[]>([]);
  const [stopsByRoute, setStopsByRoute] = useState<Record<string, BusStop[]>>({});
  const [areaMaster, setAreaMaster] = useState<Area[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, b, a] = await Promise.all([
        busApi.listRoutes(),
        busApi.listBuses(),
        busApi.listAssignments(),
      ]);
      setRoutes(r);
      setBuses(b);
      setAssignments(a);
      // Optional, permission‑gated extras — never fatal.
      studentsApi
        .list()
        .then(setStudents)
        .catch(() => undefined);
      sectionsApi
        .list()
        .then(setSections)
        .catch(() => undefined);
      // Area master data (real geographic buckets). Best-effort; never fatal.
      areasApi
        .list()
        .then(setAreaMaster)
        .catch(() => undefined);
      void (async () => {
        try {
          const schools = await schoolsApi.list();
          const campusLists = await Promise.all(
            schools.map((s) => campusesApi.list(s.id).catch(() => [])),
          );
          const campuses = campusLists.flat();
          const yearLists = await Promise.all(
            campuses.map((c) => academicYearsApi.list(c.id).catch(() => [])),
          );
          setYears(yearLists.flat());
        } catch {
          /* years optional */
        }
      })();
      // Stops feed pickup‑point derivation; best‑effort per route.
      void (async () => {
        try {
          const entries = await Promise.all(
            r.map(
              async (route) =>
                [route.id, await busApi.listStops(route.id).catch(() => [])] as const,
            ),
          );
          setStopsByRoute(Object.fromEntries(entries));
        } catch {
          /* stops optional */
        }
      })();
    } catch (e) {
      // A 403 here means the module/permission is off rather than a hard error.
      setUnavailable(true);
      setError(e instanceof Error ? e.message : 'Failed to load transport');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mergeAssignment = useCallback((a: StudentBusAssignment) => {
    setAssignments((prev) => {
      // One assignment per student — replace any existing row for the student.
      const without = prev.filter((x) => x.studentId !== a.studentId && x.id !== a.id);
      return [a, ...without];
    });
  }, []);

  const removeAssignment = useCallback((id: string) => {
    setAssignments((prev) => prev.filter((x) => x.id !== id));
  }, []);

  // --- derivations -------------------------------------------------------
  const sectionMap = useMemo(() => {
    const m = new Map<string, Section>();
    for (const s of sections) m.set(s.id, s);
    return m;
  }, [sections]);

  const gradeOf = useCallback(
    (sectionId: string | null | undefined): string | null => {
      if (!sectionId) return null;
      const sec = sectionMap.get(sectionId);
      if (!sec) return null;
      return sec.grade ? `${sec.grade.nameEn} · ${sec.name}` : sec.name;
    },
    [sectionMap],
  );

  // Real area lookups (from the Area master list + Student.areaId).
  const areaNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of areaMaster) m.set(a.id, a.name);
    return m;
  }, [areaMaster]);

  const studentAreaById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const s of students) m.set(s.id, s.areaId ?? null);
    return m;
  }, [students]);

  const assignmentByStudent = useMemo(() => {
    const m = new Map<string, StudentBusAssignment>();
    for (const a of assignments) m.set(a.studentId, a);
    return m;
  }, [assignments]);

  const assignmentsByRoute = useMemo(() => {
    const m = new Map<string, StudentBusAssignment[]>();
    for (const a of assignments) {
      const list = m.get(a.routeId) ?? [];
      list.push(a);
      m.set(a.routeId, list);
    }
    return m;
  }, [assignments]);

  // Explicit Area → Route mapping (the transport dept configures it once).
  const areasByRouteId = useMemo(() => {
    const m = new Map<string, Area[]>();
    for (const a of areaMaster) {
      if (!a.routeId) continue;
      const list = m.get(a.routeId) ?? [];
      list.push(a);
      m.set(a.routeId, list);
    }
    return m;
  }, [areaMaster]);

  // A route's area label = the area(s) it's mapped to serve. Falls back to the dominant
  // home-area of its current riders when no mapping exists yet.
  const routeAreaName = useMemo(() => {
    const m = new Map<string, string>();
    for (const route of routes) {
      const mapped = areasByRouteId.get(route.id) ?? [];
      if (mapped.length > 0) {
        m.set(route.id, mapped.map((a) => a.name).join(', '));
        continue;
      }
      const areaIds = (assignmentsByRoute.get(route.id) ?? [])
        .map((a) => studentAreaById.get(a.studentId) ?? null)
        .filter((x): x is string => Boolean(x));
      const dominant = mode(areaIds);
      m.set(route.id, dominant ? (areaNameById.get(dominant) ?? UNZONED) : UNZONED);
    }
    return m;
  }, [routes, areasByRouteId, assignmentsByRoute, studentAreaById, areaNameById]);

  const routeVMs = useMemo<RouteVM[]>(() => {
    return routes.map((route) => {
      const routeBuses = buses.filter((b) => b.routeId === route.id);
      const capacity = routeBuses.reduce((sum, b) => sum + (b.capacity ?? 0), 0);
      const list = assignmentsByRoute.get(route.id) ?? [];
      const assigned = list.length;
      const trip1 = list.filter((a) => a.tripRound === 1 || a.tripRound === 3).length;
      const trip2 = list.filter((a) => a.tripRound === 2 || a.tripRound === 3).length;
      const withLabel = routeBuses.find((b) => b.label) ?? routeBuses[0];
      const withDriver = routeBuses.find((b) => b.driver);
      return {
        route,
        area: routeAreaName.get(route.id) ?? UNZONED,
        buses: routeBuses,
        busLabel: withLabel?.label ?? withLabel?.plateNumber ?? null,
        driverName: withDriver ? busDriverName(withDriver) : null,
        capacity: capacityStatus(capacity, assigned),
        trip1,
        trip2,
      };
    });
  }, [routes, buses, assignmentsByRoute, routeAreaName]);

  const areas = useMemo<AreaVM[]>(() => {
    const vmById = new Map(routeVMs.map((vm) => [vm.route.id, vm]));
    const tally = (predicate: (s: Student) => boolean) => students.filter(predicate).length;

    // One card per active area. Its route is the explicit Area → Route mapping.
    const result: AreaVM[] = [...areaMaster]
      .filter((a) => a.active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => {
        const vm = a.routeId ? vmById.get(a.routeId) : undefined;
        const rts = vm ? [vm] : [];
        return {
          id: a.id,
          name: a.name,
          routes: rts,
          needCount: tally((s) => s.areaId === a.id && Boolean(s.transportRequested)),
          assignedCount: tally((s) => s.areaId === a.id && assignmentByStudent.has(s.id)),
          capacity: rts.reduce((s, v) => s + v.capacity.capacity, 0),
        };
      });

    // Synthetic bucket: routes mapped to no active area + students with no home area.
    const mappedRouteIds = new Set(
      areaMaster.filter((a) => a.active && a.routeId).map((a) => a.routeId as string),
    );
    const unzonedRoutes = routeVMs.filter((vm) => !mappedRouteIds.has(vm.route.id));
    const unzNeed = tally((s) => !s.areaId && Boolean(s.transportRequested));
    const unzAssigned = tally((s) => !s.areaId && assignmentByStudent.has(s.id));
    if (unzonedRoutes.length || unzNeed || unzAssigned) {
      result.push({
        id: null,
        name: UNZONED,
        routes: unzonedRoutes,
        needCount: unzNeed,
        assignedCount: unzAssigned,
        capacity: unzonedRoutes.reduce((s, v) => s + v.capacity.capacity, 0),
      });
    }
    return result;
  }, [routeVMs, areaMaster, students, assignmentByStudent]);

  const routeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of routes) m.set(r.id, r.name);
    return m;
  }, [routes]);

  const stopNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const list of Object.values(stopsByRoute)) {
      for (const s of list) m.set(s.id, s.name);
    }
    return m;
  }, [stopsByRoute]);

  const rows = useMemo<StudentRow[]>(() => {
    return students.map((student) => {
      const assignment = assignmentByStudent.get(student.id) ?? null;
      const routeName = assignment ? (routeNameById.get(assignment.routeId) ?? null) : null;
      // Real geographic area: the student's own home area (set at registration).
      const area = student.areaId ? (areaNameById.get(student.areaId) ?? UNZONED) : UNZONED;
      const pickup = assignment?.stopId ? (stopNameById.get(assignment.stopId) ?? null) : null;
      return {
        student,
        name: fullNameEn(student) || fullNameAr(student) || student.qrCode,
        nameAr: fullNameAr(student),
        grade: gradeOf(student.sectionId),
        area,
        areaId: student.areaId ?? null,
        transportRequested: Boolean(student.transportRequested),
        pickup,
        assignment,
        routeName,
        assignedAt: assignment?.createdAt ?? null,
      };
    });
  }, [students, assignmentByStudent, routeNameById, areaNameById, stopNameById, gradeOf]);

  return {
    loading,
    error,
    unavailable,
    routes,
    buses,
    students,
    years,
    sections,
    areaMaster,
    stopsByRoute,
    assignments,
    routeVMs,
    areas,
    rows,
    reload,
    mergeAssignment,
    removeAssignment,
    setRoutes,
    setBuses,
    setAreaMaster,
  };
}

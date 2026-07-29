'use client';

import { authFetch } from './auth';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
}

export interface AdvancedModuleDef {
  key: string;
  label: string;
  description: string;
}

/** The optional, feature-flagged modules (disabled by default). */
export const ADVANCED_MODULES: AdvancedModuleDef[] = [
  {
    key: 'bus_tracking',
    label: 'Bus Tracking',
    description: 'Routes, buses, live GPS, student assignments',
  },
  { key: 'library_management', label: 'Library', description: 'Catalogue books and manage loans' },
  {
    key: 'inventory_management',
    label: 'Inventory',
    description: 'Stock items and IN/OUT movements',
  },
  {
    key: 'school_clinic',
    label: 'School Clinic',
    description: 'Clinic visits and medical records',
  },
];

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const advancedApi = {
  flags: () => authFetch('/feature-flags').then((r) => json<FeatureFlag[]>(r)),

  setFlag: (key: string, enabled: boolean) =>
    authFetch(`/feature-flags/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }).then((r) => json<FeatureFlag>(r)),

  // Lightweight per-module reads/writes for the management panel.
  busRoutes: () =>
    authFetch('/bus/routes').then((r) => json<Array<{ id: string; name: string }>>(r)),
  createBusRoute: (name: string) =>
    authFetch('/bus/routes', { method: 'POST', body: JSON.stringify({ name }) }).then((r) =>
      json(r),
    ),

  books: () =>
    authFetch('/library/books').then((r) =>
      json<Array<{ id: string; title: string; copiesAvailable: number; copiesTotal: number }>>(r),
    ),
  createBook: (title: string, copiesTotal: number) =>
    authFetch('/library/books', {
      method: 'POST',
      body: JSON.stringify({ title, copiesTotal }),
    }).then((r) => json(r)),

  inventoryItems: () =>
    authFetch('/inventory/items').then((r) =>
      json<Array<{ id: string; name: string; quantity: number; unit?: string }>>(r),
    ),
  createItem: (name: string, quantity: number) =>
    authFetch('/inventory/items', {
      method: 'POST',
      body: JSON.stringify({ name, quantity }),
    }).then((r) => json(r)),

  clinicVisits: () =>
    authFetch('/clinic/visits').then((r) =>
      json<Array<{ id: string; reason: string; outcome: string; visitedAt: string }>>(r),
    ),
};

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

export type BookLoanStatus = 'ACTIVE' | 'RETURNED' | 'OVERDUE';

export interface Book {
  id: string;
  title: string;
  author?: string | null;
  isbn?: string | null;
  category?: string | null;
  copiesTotal: number;
  copiesAvailable: number;
}

export interface BookLoan {
  id: string;
  bookId: string;
  studentId?: string | null;
  borrowerName?: string | null;
  status: BookLoanStatus;
  borrowedAt: string;
  dueDate: string;
  returnedAt?: string | null;
}

export interface CreateBookInput {
  title: string;
  author?: string;
  isbn?: string;
  category?: string;
  copiesTotal?: number;
}

export interface CheckoutInput {
  bookId: string;
  borrowerName?: string;
  studentId?: string;
  dueDate: string;
}

export const libraryApi = {
  books: () => authFetch('/library/books').then((r) => json<Book[]>(r)),
  createBook: (data: CreateBookInput) =>
    authFetch('/library/books', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<Book>(r),
    ),
  loans: (status?: BookLoanStatus) =>
    authFetch(`/library/loans${status ? `?status=${status}` : ''}`).then((r) =>
      json<BookLoan[]>(r),
    ),
  checkout: (data: CheckoutInput) =>
    authFetch('/library/loans', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<BookLoan>(r),
    ),
  returnLoan: (id: string) =>
    authFetch(`/library/loans/${id}/return`, { method: 'POST' }).then((r) => json<BookLoan>(r)),
};

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export type InventoryTxnType = 'IN' | 'OUT' | 'ADJUST';

export const INVENTORY_TXN_TYPES: InventoryTxnType[] = ['IN', 'OUT', 'ADJUST'];

export interface InventoryItem {
  id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  unit?: string | null;
  quantity: number;
  reorderLevel?: number | null;
  location?: string | null;
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  type: InventoryTxnType;
  quantity: number;
  reason?: string | null;
  createdAt: string;
}

export interface CreateItemInput {
  name: string;
  sku?: string;
  category?: string;
  unit?: string;
  quantity?: number;
  reorderLevel?: number;
  location?: string;
}

export interface RecordTxnInput {
  itemId: string;
  type: InventoryTxnType;
  quantity: number;
  reason?: string;
}

export const inventoryApi = {
  items: () => authFetch('/inventory/items').then((r) => json<InventoryItem[]>(r)),
  createItem: (data: CreateItemInput) =>
    authFetch('/inventory/items', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<InventoryItem>(r),
    ),
  transactions: (itemId?: string) =>
    authFetch(`/inventory/transactions${itemId ? `?itemId=${itemId}` : ''}`).then((r) =>
      json<InventoryTransaction[]>(r),
    ),
  recordTransaction: (data: RecordTxnInput) =>
    authFetch('/inventory/transactions', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<InventoryTransaction>(r),
    ),
};

// ---------------------------------------------------------------------------
// School clinic
// ---------------------------------------------------------------------------

export type ClinicOutcome = 'RESOLVED' | 'SENT_HOME' | 'REFERRED' | 'HOSPITALIZED';

export const CLINIC_OUTCOMES: ClinicOutcome[] = [
  'RESOLVED',
  'SENT_HOME',
  'REFERRED',
  'HOSPITALIZED',
];

export interface ClinicVisit {
  id: string;
  studentId: string;
  reason: string;
  symptoms?: string | null;
  treatment?: string | null;
  temperature?: number | string | null;
  outcome: ClinicOutcome;
  visitedAt: string;
}

export interface CreateVisitInput {
  studentId: string;
  reason: string;
  symptoms?: string;
  treatment?: string;
  temperature?: number;
  outcome?: ClinicOutcome;
}

export interface MedicalRecord {
  bloodType?: string | null;
  allergies?: string | null;
  chronicConditions?: string | null;
  medications?: string | null;
  emergencyContact?: string | null;
  notes?: string | null;
}

export const clinicApi = {
  visits: (studentId?: string) =>
    authFetch(`/clinic/visits${studentId ? `?studentId=${studentId}` : ''}`).then((r) =>
      json<ClinicVisit[]>(r),
    ),
  createVisit: (data: CreateVisitInput) =>
    authFetch('/clinic/visits', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<ClinicVisit>(r),
    ),
  getRecord: (studentId: string) =>
    authFetch(`/clinic/students/${studentId}/record`).then((r) => json<MedicalRecord | null>(r)),
  upsertRecord: (studentId: string, data: MedicalRecord) =>
    authFetch(`/clinic/students/${studentId}/record`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then((r) => json<MedicalRecord>(r)),
};

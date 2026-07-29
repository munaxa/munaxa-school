'use client';

import { authFetch } from './auth';

/** Family Finance domain client — the financial customer (FinancialAccount) is the primary entity. */

export type FinancialAccountOwnerType =
  | 'GUARDIAN'
  | 'GRANDPARENT'
  | 'COMPANY'
  | 'CHARITY'
  | 'SPONSOR'
  | 'GOVERNMENT'
  | 'SCHOLARSHIP_ORG'
  | 'COURT_ORDER'
  | 'RELATIVE'
  | 'OTHER';

export interface FamilySearchHit {
  financialAccountId: string | null;
  parentId: string | null;
  studentId: string | null;
  ownerType: FinancialAccountOwnerType;
  nameEn: string;
  nameAr: string;
  phone: string | null;
  email: string | null;
  nationalId: string | null;
  studentCount: number;
}

export interface FamilySummary {
  charged: string;
  discounts: string;
  netCharged: string;
  paid: string;
  outstanding: string;
  creditBalance: string;
  refunded: string;
  nextDue: { dueDate: string; amount: string } | null;
  lastPayment: { date: string; amount: string } | null;
  collectionStatus: 'NONE' | 'FINANCIAL_ISSUE' | 'LEGAL';
  childrenCount: number;
}

export interface FamilyStudent {
  studentId: string;
  studentAccountId: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  gradeNameEn: string | null;
  gradeNameAr: string | null;
}

export interface FamilyDashboard {
  account: {
    id: string;
    ownerType: FinancialAccountOwnerType;
    nameEn: string;
    nameAr: string;
    phone: string | null;
    email: string | null;
    currency: string;
    status: string;
  };
  summary: FamilySummary;
  students: FamilyStudent[];
}

export interface FamilyStatement {
  financialAccountId: string;
  totals: FamilySummary;
  children: Array<{
    studentId: string;
    firstNameEn: string;
    lastNameEn: string;
    firstNameAr: string;
    lastNameAr: string;
    gradeNameEn: string | null;
    gradeNameAr: string | null;
    totals: {
      charged: string;
      discounts: string;
      netCharged: string;
      paid: string;
      outstanding: string;
      creditBalance: string;
      refunded: string;
    };
  }>;
  payments: Array<{
    id: string;
    amount: string;
    method: string;
    status: string;
    createdAt: string;
    receiptNo: number | null;
  }>;
}

export type PaymentMethod = 'CASH' | 'CLIQ' | 'EWALLET' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD';

export type BillingScheduleStatus = 'PAID' | 'PARTIAL' | 'OVERDUE' | 'UPCOMING';

export interface BillingScheduleLine {
  installmentId: string;
  studentId: string;
  studentName: string;
  chargeDescription: string;
  amount: string;
  paid: string;
  balance: string;
  status: BillingScheduleStatus;
}

export interface BillingScheduleRow {
  dueDate: string | null;
  amount: string;
  paid: string;
  balance: string;
  status: BillingScheduleStatus;
  lines: BillingScheduleLine[];
}

/** The Financial Account's Billing Schedule — one dynamically merged plan across all its students. */
export interface BillingSchedule {
  rows: BillingScheduleRow[];
  totals: { amount: string; paid: string; balance: string };
}

/** Account-centric finance overview — the workspace dashboard (shown before an account is opened). */
export interface FinanceOverview {
  kpis: {
    totalOutstanding: string;
    collectedToday: string;
    collectedThisMonth: string;
    overdueAccounts: number;
    pendingInstallments: number;
    activePaymentPlans: number;
  };
  largestOutstandingAccounts: Array<{
    payerId: string;
    name: string;
    outstanding: string;
    nextDueDate: string | null;
    nextDueAmount: string | null;
    collectionStatus: 'NONE' | 'FINANCIAL_ISSUE' | 'LEGAL';
  }>;
  recentPayments: Array<{
    id: string;
    payerId: string | null;
    accountName: string;
    amount: string;
    method: string;
    at: string | null;
    receiptNo: number | null;
  }>;
  upcomingInstallments: Array<{
    payerId: string;
    accountName: string;
    dueDate: string | null;
    amount: string;
  }>;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const familiesApi = {
  search: (q: string) =>
    authFetch(`/finance/families/search?q=${encodeURIComponent(q)}`).then((r) =>
      json<FamilySearchHit[]>(r),
    ),
  // Explicitly move a student's billing to another linked guardian (carries the ledger; audited).
  // A reason is mandatory (finance must know WHY the legal payer changed).
  transferBilling: (studentId: string, toParentId: string, reason: string, notes?: string) =>
    authFetch(`/finance/families/transfer-billing`, {
      method: 'POST',
      body: JSON.stringify({ studentId, toParentId, reason, ...(notes ? { notes } : {}) }),
    }).then((r) =>
      json<{ studentId: string; payerId: string; moved: boolean; transferId?: string }>(r),
    ),
  overview: () => authFetch(`/finance/families/dashboard`).then((r) => json<FinanceOverview>(r)),
  byStudent: (studentId: string) =>
    authFetch(`/finance/families/by-student/${studentId}`).then((r) =>
      json<{ account: { id: string } | null; studentId: string }>(r),
    ),
  dashboard: (financialAccountId: string) =>
    authFetch(`/finance/families/${financialAccountId}`).then((r) => json<FamilyDashboard>(r)),
  byParent: (parentId: string) =>
    authFetch(`/finance/families/by-parent/${parentId}`).then((r) =>
      json<{
        account: { id: string; nameEn: string; ownerType: FinancialAccountOwnerType } | null;
        students: FamilyStudent[];
      }>(r),
    ),
  statement: (financialAccountId: string) =>
    authFetch(`/finance/families/${financialAccountId}/statement`).then((r) =>
      json<FamilyStatement>(r),
    ),
  schedule: (financialAccountId: string) =>
    authFetch(`/finance/families/${financialAccountId}/schedule`).then((r) =>
      json<BillingSchedule>(r),
    ),
  recordPayment: (
    financialAccountId: string,
    data: {
      amount: number;
      method: PaymentMethod;
      reference?: string;
      note?: string;
      // Optional MANUAL allocation — assign the payment to specific installments (else auto FIFO).
      allocations?: Array<{ installmentId: string; amount: number }>;
    },
  ) =>
    authFetch(`/finance/payments/family/${financialAccountId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<{ id: string; status: string }>(r)),
  outstandingReport: (groupBy: 'family' | 'student') =>
    authFetch(`/finance/reports/outstanding?groupBy=${groupBy}`).then((r) =>
      json<
        Array<{
          dimId: string | null;
          label: string;
          gross: string;
          discount: string;
          net: string;
          paid: string;
          outstanding: string;
          chargeCount: number;
        }>
      >(r),
    ),
};

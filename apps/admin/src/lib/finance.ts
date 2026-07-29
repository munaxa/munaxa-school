'use client';

import { authFetch } from './auth';

// ─────────────────────────────────────────────────────────── Accounts Receivable

export type PaymentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type ChargeStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'WAIVED' | 'WRITTEN_OFF' | 'CANCELLED';
export type InstallmentStatus = 'SCHEDULED' | 'PARTIAL' | 'PAID' | 'WAIVED' | 'CANCELLED';
export type PaymentPlanCadence = 'MONTHLY' | 'WEEKLY' | 'QUARTERLY' | 'CUSTOM';

/** A payment (money received) enriched for the statement. */
export interface Payment {
  id: string;
  amount: string;
  method: string;
  status: PaymentStatus;
  reference?: string | null;
  parentNotifiedAt?: string | null;
  createdAt?: string | null;
  receiptNo?: number | null;
  recordedByName?: string | null;
  einvoice?: { invoiceNumber: string; status: string; docType: string } | null;
}

export interface Installment {
  id: string;
  seq: number;
  dueDate: string | null;
  amount: string;
  paid: string;
  balance: string;
  status: InstallmentStatus;
  overdue: boolean;
}

export interface PaymentPlan {
  id: string;
  cadence: PaymentPlanCadence;
  installments: number;
  firstDueDate: string;
  balloonFinal: boolean;
  status: string;
}

/** A superseded/completed plan retained for history (shown only in the plan-history view). */
export interface PlanHistory {
  id: string;
  cadence: PaymentPlanCadence;
  count: number;
  firstDueDate: string;
  balloonFinal: boolean;
  status: string;
  scheduled: string;
  paid: string;
  lines: Installment[];
}

/** A charge (obligation) with its ACTIVE plan + installments and derived balances (the hierarchy). */
export interface ChargeView {
  charge: {
    id: string;
    description: string;
    amount: string;
    status: ChargeStatus;
    dueDate?: string | null;
  };
  gross: string;
  discount: string;
  net: string;
  paid: string;
  balance: string;
  plan: PaymentPlan | null;
  installments: Installment[];
  /** Superseded/completed plans, hidden by default and shown in a history view. */
  history?: PlanHistory[];
  /** Underlying fee-line breakdown of an aggregate charge (details then sum). Empty otherwise. */
  lineItems?: Array<{ label: string; amount: string }>;
}

export interface Adjustment {
  id: string;
  type: string;
  amount: string;
  percent: string | null;
  reason: string;
  status: string;
  chargeId: string | null;
  createdAt: string;
}

export interface Credit {
  id: string;
  source: string;
  amount: string;
  remaining: string;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface Refund {
  id: string;
  amount: string;
  method: string;
  reason: string;
  status: string;
  createdAt: string;
}

export interface AccountSummary {
  charged: string;
  discounts: string;
  netCharged: string;
  paid: string;
  outstanding: string;
  creditBalance: string;
  refunded: string;
}

/** The hierarchical student statement: Account → Charges → Plans → Installments (+ money lists). */
export interface Statement {
  studentId: string;
  account: { id: string; currency: string; status: string; payerId: string | null };
  charges: ChargeView[];
  payments: Payment[];
  adjustments: Adjustment[];
  credits: Credit[];
  refunds: Refund[];
  totals: AccountSummary;
}

export interface HouseholdMember {
  studentId: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  outstanding: string;
}

export interface ParentStudent {
  studentId: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  gradeNameEn: string | null;
  gradeNameAr: string | null;
  transportRequested: boolean;
  relation: string;
  isPrimary: boolean;
  outstanding: string;
}

export type CollectionsStatus = 'NONE' | 'FINANCIAL_ISSUE' | 'LEGAL';

export interface CollectionsProfile {
  studentId: string;
  collectionsStatus: CollectionsStatus;
  legalNote: string | null;
  flaggedAt: string | null;
  lastReminderAt: string | null;
  transportSuspended: boolean;
  transportSuspendedAt: string | null;
  transportSuspendedReason: string | null;
  transportSuspendedById: string | null;
  transportReinstatedAt: string | null;
  feeModified: boolean;
  customArrangement: boolean;
  snapshot: {
    outstanding: string;
    dueThisMonth: string;
    overdue: string;
    overdueCount: number;
    oldestOverdueDays: number;
    delinquencyLevel: number;
    eligible: boolean;
  };
  /** Dunning events (reminders) recorded on the account's collections case. */
  reminders: Array<{
    id: string;
    type: string;
    channels: string[];
    outstanding: string | null;
    dueThisMonth: string | null;
    overdue: string | null;
    recipientCount: number;
    smsSentCount: number;
    createdAt: string;
  }>;
  /** Promises-to-pay (with derived status), newest first. */
  promises: PromiseToPayView[];
  /** Logged parent contacts (Communication Log), newest first. */
  communications: CommunicationEntry[];
}

export type PromiseStatus = 'OPEN' | 'KEPT' | 'BROKEN' | 'OVERDUE';

export interface PromiseToPayView {
  id: string;
  amount: string;
  promiseBy: string;
  note: string | null;
  createdById: string | null;
  createdAt: string;
  status: PromiseStatus;
}

export type CommunicationMedium = 'PHONE' | 'WHATSAPP' | 'SMS' | 'EMAIL' | 'MEETING' | 'NOTE';

export interface CommunicationEntry {
  id: string;
  type: string;
  medium: CommunicationMedium | null;
  detail: string | null;
  actorId: string | null;
  createdAt: string;
}

export interface AgingBuckets {
  studentId: string;
  studentName?: string;
  current: string;
  d1_30: string;
  d31_60: string;
  d61_90: string;
  d90plus: string;
  total: string;
}

export interface DashboardPromise {
  id: string;
  studentId: string;
  studentName: string;
  amount: string;
  promiseBy: string;
}

export interface FinanceDashboard {
  promisesDueToday: DashboardPromise[];
  promisesMissed: DashboardPromise[];
  transportSuspensions: Array<{
    studentId: string;
    studentName: string;
    suspendedAt: string | null;
  }>;
  topOutstanding: Array<{
    studentId: string;
    studentName: string;
    outstanding: string;
    overdue: string;
  }>;
  workload: {
    studentsWithOutstanding: number;
    overdueStudents: number;
    openCases: number;
    promisesOpen: number;
    transportSuspended: number;
  };
  totalOutstanding: string;
  collectedPct: string;
}

export interface AgingReport {
  rows: AgingBuckets[];
  totals: Omit<AgingBuckets, 'studentId' | 'studentName'>;
  collectedPct: string;
}

export interface PushOutstandingInput {
  minAgeDays?: 30 | 60 | 90;
  minAmount?: string;
  match?: 'ALL' | 'ANY';
  mandatory?: boolean;
  email?: boolean;
}

export interface PushOutstandingResult {
  filter: { minAgeDays: number | null; minAmount: string | null; match: 'ALL' | 'ANY' };
  candidates: number;
  matched: number;
  pushed: number;
  skippedLegal: number;
  skippedNoParent: number;
  totalRecipients: number;
  totalEmails: number;
}

export interface TransportEvaluation {
  studentId: string;
  overdueCount: number;
  threshold: number;
  suspended: boolean;
  changed: boolean;
}

/** One row of the dimensional finance report (revenue/outstanding by year/grade/campus/category). */
export interface FinanceDimensionRow {
  dimId: string | null;
  label: string;
  gross: string;
  discount: string;
  net: string;
  paid: string;
  outstanding: string;
  chargeCount: number;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const financeApi = {
  // ── Account, charges, plans, installments ──
  account: (studentId: string) =>
    authFetch(`/finance/accounts/${studentId}`).then((r) =>
      json<{ account: Statement['account']; summary: AccountSummary }>(r),
    ),
  statement: (studentId: string) =>
    authFetch(`/finance/students/${studentId}/statement`).then((r) => json<Statement>(r)),
  household: (studentId: string) =>
    authFetch(`/finance/students/${studentId}/household`).then((r) => json<HouseholdMember[]>(r)),
  parentStudents: (parentId: string) =>
    authFetch(`/finance/students/by-parent/${parentId}`).then((r) => json<ParentStudent[]>(r)),
  charges: (studentId: string) =>
    authFetch(`/finance/charges?studentId=${encodeURIComponent(studentId)}`).then((r) =>
      json<ChargeView[]>(r),
    ),
  createCharge: (data: {
    studentId: string;
    description: string;
    amount: number;
    dueDate?: string;
    feeItemId?: string;
    academicYearId?: string;
    gradeId?: string;
  }) =>
    authFetch('/finance/charges', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<{ id: string }>(r),
    ),
  /**
   * Create or replace the payment plan for a charge (schedules the OUTSTANDING balance).
   * `reason` is required by the UI for a REPLACE (advanced action) and is recorded in the audit log.
   */
  createPlan: (
    chargeId: string,
    data: {
      cadence: PaymentPlanCadence;
      installments: number;
      firstDueDate: string;
      balloonFinal?: boolean;
      reason?: string;
    },
  ) =>
    authFetch(`/finance/charges/${chargeId}/plan`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<PaymentPlan>(r)),
  cancelCharge: (chargeId: string) =>
    authFetch(`/finance/charges/${chargeId}/cancel`, { method: 'POST' }).then((r) => json(r)),
  rescheduleInstallment: (installmentId: string, data: { dueDate?: string; amount?: number }) =>
    authFetch(`/finance/installments/${installmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => json(r)),

  // ── Payments (money received) ──
  listPayments: (studentId: string) =>
    authFetch(`/finance/payments?studentId=${encodeURIComponent(studentId)}`).then((r) =>
      json<Payment[]>(r),
    ),
  recordPayment: (data: {
    studentId: string;
    amount: number;
    method: string;
    reference?: string;
  }) =>
    authFetch('/finance/payments', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<{ id: string }>(r),
    ),
  verify: (id: string) =>
    authFetch(`/finance/payments/${id}/verify`, { method: 'POST' }).then((r) => json(r)),
  reject: (id: string) =>
    authFetch(`/finance/payments/${id}/reject`, { method: 'POST', body: '{}' }).then((r) =>
      json(r),
    ),
  notifyParent: (id: string) =>
    authFetch(`/finance/payments/${id}/notify-parent`, { method: 'POST' }).then((r) =>
      json<Payment>(r),
    ),

  // ── Ledger — adjustments, allocation, credits, refunds ──
  applyAdjustment: (data: {
    studentId: string;
    chargeId?: string;
    type: string;
    amount?: number;
    percent?: number;
    reason: string;
  }) =>
    authFetch('/finance/ledger/adjustments', { method: 'POST', body: JSON.stringify(data) }).then(
      (r) => json(r),
    ),
  reverseAdjustment: (id: string) =>
    authFetch(`/finance/ledger/adjustments/${id}/reverse`, { method: 'POST' }).then((r) => json(r)),
  /** Apply a verified payment to one or more installments. */
  allocate: (paymentId: string, allocations: Array<{ installmentId: string; amount: number }>) =>
    authFetch('/finance/ledger/allocate', {
      method: 'POST',
      body: JSON.stringify({ paymentId, allocations }),
    }).then((r) => json(r)),
  credits: (studentId: string) =>
    authFetch(`/finance/ledger/credits?studentId=${encodeURIComponent(studentId)}`).then((r) =>
      json<Credit[]>(r),
    ),
  createRefund: (data: { studentId: string; amount: number; method: string; reason: string }) =>
    authFetch('/finance/ledger/refunds', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json(r),
    ),
  verifyRefund: (id: string) =>
    authFetch(`/finance/ledger/refunds/${id}/verify`, { method: 'POST' }).then((r) => json(r)),

  // ── Collections & reminders ──
  collections: (studentId: string) =>
    authFetch(`/finance/collections/students/${studentId}`).then((r) =>
      json<CollectionsProfile>(r),
    ),
  setCollections: (studentId: string, data: { status: CollectionsStatus; note?: string }) =>
    authFetch(`/finance/collections/students/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then((r) => json(r)),
  remind: (studentId: string, channels: string[], level?: string) =>
    authFetch(`/finance/collections/students/${studentId}/reminders`, {
      method: 'POST',
      body: JSON.stringify({ channels, ...(level ? { level } : {}) }),
    }).then((r) => json<{ recipients: number; smsSent: number; emailsSent: number }>(r)),
  suspendTransport: (studentId: string, reason: string) =>
    authFetch(`/finance/collections/students/${studentId}/transport/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }).then((r) => json(r)),
  reinstateTransport: (studentId: string) =>
    authFetch(`/finance/collections/students/${studentId}/transport/reinstate`, {
      method: 'POST',
    }).then((r) => json(r)),
  pushOutstanding: (data: PushOutstandingInput) =>
    authFetch('/finance/collections/reminders/push-outstanding', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<PushOutstandingResult>(r)),

  // ── Promise to Pay ──
  recordPromise: (studentId: string, data: { amount: string; promiseBy: string; note?: string }) =>
    authFetch(`/finance/collections/students/${studentId}/promises`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<PromiseToPayView>(r)),
  listPromises: (studentId: string) =>
    authFetch(`/finance/collections/students/${studentId}/promises`).then((r) =>
      json<PromiseToPayView[]>(r),
    ),
  resolvePromise: (promiseId: string, kept: boolean) =>
    authFetch(`/finance/collections/promises/${promiseId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ kept }),
    }).then((r) => json<PromiseToPayView>(r)),

  // ── Communication Log ──
  logCommunication: (studentId: string, data: { medium: CommunicationMedium; note: string }) =>
    authFetch(`/finance/collections/students/${studentId}/communications`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<CommunicationEntry>(r)),
  listCommunications: (studentId: string) =>
    authFetch(`/finance/collections/students/${studentId}/communications`).then((r) =>
      json<CommunicationEntry[]>(r),
    ),

  // ── Dimensional finance report (revenue/outstanding by year/grade/campus/category) ──
  reportSummary: (dimension: 'academicYear' | 'grade' | 'campus' | 'category') =>
    authFetch(`/finance/reports/summary?dimension=${dimension}`).then((r) =>
      json<FinanceDimensionRow[]>(r),
    ),

  // ── Aging / collection effectiveness ──
  aging: () => authFetch('/finance/collections/aging').then((r) => json<AgingReport>(r)),
  financeDashboard: () =>
    authFetch('/finance/collections/dashboard').then((r) => json<FinanceDashboard>(r)),
  studentAging: (studentId: string) =>
    authFetch(`/finance/collections/students/${studentId}/aging`).then((r) =>
      json<AgingBuckets>(r),
    ),

  // ── Transport suspension (non-payment) ──
  evaluateTransport: (studentId: string) =>
    authFetch(`/finance/collections/students/${studentId}/transport/evaluate`, {
      method: 'POST',
    }).then((r) => json<TransportEvaluation>(r)),
  evaluateTransportAll: () =>
    authFetch('/finance/collections/transport/evaluate', { method: 'POST' }).then((r) =>
      json<{ evaluated: number; suspended: number; restored: number }>(r),
    ),
};

// ── Enrollment & billing configuration ──
export type DiscountType = 'FULL_PAYMENT' | 'SIBLING' | 'SCHOLARSHIP' | 'PROMOTIONAL' | 'MANUAL';
export type DiscountCalc = 'FIXED' | 'PERCENT';
export type TransportDirection = 'NONE' | 'ONE_WAY' | 'TWO_WAY';

export interface GradeFeeSchedule {
  id: string;
  gradeId: string;
  academicYearId: string;
  registrationFee: string;
  tuitionFee: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}
export interface TransportFare {
  id: string;
  academicYearId: string;
  routeId: string | null;
  route: {
    id: string;
    name: string;
    description: string | null;
    round1Time: string | null;
    round2Time: string | null;
    disabledAt: string | null;
  } | null;
  amount: string;
  oneWayPct: string;
  isActive: boolean;
}
export interface DiscountRule {
  id: string;
  name: string;
  type: DiscountType;
  calc: DiscountCalc;
  value: string;
  maxAmount: string | null;
  appliesToTransport: boolean;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}
export interface BillingPolicy {
  id: string;
  minInstallments: number;
  maxInstallments: number;
  fullPaymentDiscountPct: string;
  suspendTransportAfterOverdue: number;
  suspendTransportAfterDays: number | null;
  suspendTransportAfterAmount: string | null;
  allowSelfFeeApproval: boolean;
}

export const feeConfigApi = {
  gradeFees: (academicYearId?: string) =>
    authFetch(
      `/finance/fee-config/grade-fees${academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : ''}`,
    ).then((r) => json<GradeFeeSchedule[]>(r)),
  createGradeFee: (data: {
    gradeId: string;
    academicYearId: string;
    registrationFee: number;
    tuitionFee: number;
    effectiveFrom: string;
    effectiveTo?: string;
  }) =>
    authFetch('/finance/fee-config/grade-fees', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<GradeFeeSchedule>(r)),
  updateGradeFee: (
    id: string,
    data: Partial<{
      gradeId: string;
      academicYearId: string;
      registrationFee: number;
      tuitionFee: number;
      effectiveFrom: string;
      effectiveTo: string;
      isActive: boolean;
    }>,
  ) =>
    authFetch(`/finance/fee-config/grade-fees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => json<GradeFeeSchedule>(r)),

  transportFares: (academicYearId?: string) =>
    authFetch(
      `/finance/fee-config/transport-fares${academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : ''}`,
    ).then((r) => json<TransportFare[]>(r)),
  createTransportFare: (data: {
    academicYearId: string;
    routeId?: string;
    routeName?: string;
    amount: number;
    oneWayPct?: number;
  }) =>
    authFetch('/finance/fee-config/transport-fares', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<TransportFare>(r)),
  updateTransportFare: (
    id: string,
    data: Partial<{
      academicYearId: string;
      routeId: string | null;
      routeName: string;
      amount: number;
      oneWayPct: number;
      isActive: boolean;
    }>,
  ) =>
    authFetch(`/finance/fee-config/transport-fares/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => json<TransportFare>(r)),
  deleteTransportFare: (id: string) =>
    authFetch(`/finance/fee-config/transport-fares/${id}`, { method: 'DELETE' }).then(
      () => undefined,
    ),

  discountRules: () =>
    authFetch('/finance/fee-config/discount-rules').then((r) => json<DiscountRule[]>(r)),
  createDiscountRule: (data: {
    name: string;
    type: DiscountType;
    calc: DiscountCalc;
    value: number;
    maxAmount?: number;
    appliesToTransport?: boolean;
  }) =>
    authFetch('/finance/fee-config/discount-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<DiscountRule>(r)),
  updateDiscountRule: (
    id: string,
    data: Partial<{
      name: string;
      type: DiscountType;
      calc: DiscountCalc;
      value: number;
      maxAmount: number;
      appliesToTransport: boolean;
      isActive: boolean;
    }>,
  ) =>
    authFetch(`/finance/fee-config/discount-rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => json<DiscountRule>(r)),

  policy: () => authFetch('/finance/fee-config/policy').then((r) => json<BillingPolicy | null>(r)),
  upsertPolicy: (data: {
    minInstallments: number;
    maxInstallments: number;
    fullPaymentDiscountPct: number;
    suspendTransportAfterOverdue: number;
    suspendTransportAfterDays?: number;
    suspendTransportAfterAmount?: number;
    allowSelfFeeApproval?: boolean;
  }) =>
    authFetch('/finance/fee-config/policy', {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then((r) => json<BillingPolicy>(r)),
};

// ── Enrollment quote ──
export interface EnrollmentQuote {
  registrationFee: string;
  tuitionFee: string;
  tuitionDiscount: string;
  transportFee: string;
  total: string;
  fullPayment: boolean;
  installments: number;
  lines: { key: 'registration' | 'tuition' | 'transport' | 'discount'; amount: string }[];
  schedule: { index: number; dueDate: string; amount: string }[];
  warnings: string[];
}

export const enrollmentApi = {
  quote: (data: {
    gradeId: string;
    academicYearId: string;
    transportDirection?: TransportDirection;
    transportRouteGroup?: string;
    fullPayment?: boolean;
    installments?: number;
    firstDueDate?: string;
  }) =>
    authFetch('/enrollment/quote', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<EnrollmentQuote>(r),
    ),
};

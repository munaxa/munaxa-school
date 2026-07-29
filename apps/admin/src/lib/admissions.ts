'use client';

import { authFetch } from './auth';

export type TransportDirection = 'NONE' | 'ONE_WAY' | 'TWO_WAY';
export type QuotePaymentMode = 'FULL' | 'INSTALLMENTS';
export type FeeItemKind =
  | 'REGISTRATION'
  | 'TUITION'
  | 'BOOKS'
  | 'UNIFORM'
  | 'INSURANCE'
  | 'ACTIVITY'
  | 'TECHNOLOGY'
  | 'EXAM'
  | 'LABORATORY'
  | 'TRANSPORT'
  | 'CUSTOM';

export interface QuoteLine {
  kind: FeeItemKind;
  feeItemId: string | null;
  label: string;
  amount: string;
  discountable: boolean;
  discountAmount: string;
  overridden: boolean;
  originalAmount: string | null;
}
export interface QuoteInstallment {
  index: number;
  dueDate: string;
  amount: string;
}
export interface ComputedQuote {
  academicYearId: string;
  gradeId: string;
  studentId: string | null;
  transportDirection: TransportDirection;
  paymentMode: QuotePaymentMode;
  installments: number;
  firstDueDate: string | null;
  lines: QuoteLine[];
  totalFees: string;
  discountEligible: string;
  nonDiscountEligible: string;
  discountAmount: string;
  grandTotal: string;
  schedule: QuoteInstallment[];
  feeModified: boolean;
  warnings: string[];
  quoteId?: string;
}

export interface FeeOverride {
  kind: FeeItemKind;
  amount: number;
  reason: string;
}

export interface QuoteRequest {
  gradeId: string;
  academicYearId: string;
  studentId?: string;
  transportDirection?: TransportDirection;
  transportRouteGroup?: string;
  paymentMode?: QuotePaymentMode;
  installments?: number;
  firstDueDate?: string;
  overrides?: FeeOverride[];
  persist?: boolean;
}

export interface CommitRequest {
  quoteId: string;
  idempotencyKey: string;
  existingStudentId?: string;
  student?: {
    firstNameEn: string;
    lastNameEn: string;
    firstNameAr?: string;
    lastNameAr?: string;
    gender?: 'MALE' | 'FEMALE';
    dateOfBirth?: string;
    nationalId?: string;
  };
  parent?: {
    firstNameEn: string;
    lastNameEn: string;
    firstNameAr?: string;
    lastNameAr?: string;
    phone: string;
    phoneAlt?: string;
    email?: string;
    relation?: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';
  };
  /** Existing parent to link (chosen instead of entering a new parent). */
  existingParentId?: string;
  sectionId?: string;
  /** Fleet route to assign the student to (bus tracking). */
  busRouteId?: string;
  /** Trip of the route the student rides: 1 (1st) or 2 (2nd). */
  busTripRound?: number;
  /** Home area the student lives in (drives Fleet's Area Planning). */
  areaId?: string;
  /** Whether the parent requested transportation (feeds the Unassigned queue). */
  transportRequested?: boolean;
  /**
   * Whether the one-time registration fee was paid at registration (the usual case; default true).
   * When false it is folded into the monthly installment plan instead of billed as its own charge.
   */
  registrationFeePaid?: boolean;
}

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

/** One student entry in a family registration — carries its own persisted quote. */
export interface FamilyStudentEntry {
  quoteId: string;
  existingStudentId?: string;
  student?: {
    firstNameEn: string;
    lastNameEn: string;
    firstNameAr?: string;
    lastNameAr?: string;
    gender?: 'MALE' | 'FEMALE';
    dateOfBirth?: string;
    nationalId?: string;
  };
  sectionId?: string;
  busRouteId?: string;
  busTripRound?: number;
  areaId?: string;
  transportRequested?: boolean;
}

/** Atomic family registration: one guardian/customer, one payment plan, one or more students. */
export interface FamilyCommitRequest {
  idempotencyKey: string;
  academicYearId: string;
  existingParentId?: string;
  parent?: {
    firstNameEn: string;
    lastNameEn: string;
    firstNameAr?: string;
    lastNameAr?: string;
    phone: string;
    phoneAlt?: string;
    email?: string;
    relation?: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';
  };
  ownerType?: FinancialAccountOwnerType;
  paymentMode: QuotePaymentMode;
  installments?: number;
  firstDueDate?: string;
  registrationFeePaid?: boolean;
  students: FamilyStudentEntry[];
}

export type AddFamilyStudentMode = 'MERGE' | 'SEPARATE' | 'NEW_PLAN';

export interface AddFamilyStudentRequest {
  idempotencyKey: string;
  quoteId: string;
  mode: AddFamilyStudentMode;
  existingStudentId?: string;
  student?: FamilyStudentEntry['student'];
  sectionId?: string;
  busRouteId?: string;
  busTripRound?: number;
  areaId?: string;
  transportRequested?: boolean;
  registrationFeePaid?: boolean;
  paymentMode?: QuotePaymentMode;
  installments?: number;
  firstDueDate?: string;
  confirm?: boolean;
}

export type AdmissionCase = 'NEW' | 'ACTIVE' | 'RETURNING';

export interface IdentityStudentSummary {
  id: string;
  studentNumber: string | null;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  nationalId: string | null;
  moeStudentNumber: string | null;
  financialAccountId: string | null;
}

export interface IdentityLookupResult {
  case: AdmissionCase;
  student: IdentityStudentSummary | null;
  currentEnrollment: {
    id: string;
    status: string;
    gradeName: string;
    academicYearName: string;
  } | null;
}

export interface EnrollmentRow {
  id: string;
  // `admissionStatus` = admission workflow (Draft/Quoted/Accepted/Registered/Cancelled);
  // `status` = participation in the year (Active/Completed/Promoted/…). See Decision 2.
  admissionStatus: string;
  status: string;
  feeModified: boolean;
  transportDirection: TransportDirection;
  paymentMode: QuotePaymentMode;
  createdAt: string;
  student: { id: string; firstNameEn: string; lastNameEn: string };
  grade: { nameEn: string };
  academicYear: { name: string };
}

export interface ReturningStudent {
  id: string;
  firstNameEn: string;
  lastNameEn: string;
  billingProfile: { feeModified: boolean; customArrangement: boolean } | null;
  parentLinks: Array<{
    parent: { id: string; firstNameEn: string; lastNameEn: string; phone: string | null };
  }>;
  enrollments: Array<{
    id: string;
    grade: { nameEn: string };
    academicYear: { name: string };
    transportDirection: TransportDirection;
  }>;
}

export interface FeeItem {
  id: string;
  kind: FeeItemKind;
  nameEn: string;
  nameAr: string;
  mandatory: boolean;
  discountable: boolean;
  isActive: boolean;
}

export interface GradeFeeItem {
  id: string;
  feeItemId: string;
  gradeId: string;
  academicYearId: string;
  amount: string;
  mandatory: boolean;
  discountable: boolean;
  isActive: boolean;
  effectiveFrom: string;
  feeItem: FeeItem;
}

export interface FeeModificationRow {
  id: string;
  field: string;
  originalValue: string;
  newValue: string;
  difference: string;
  reason: string;
  modifiedAt: string;
  approval: { id: string; status: string; note: string | null; decidedAt: string | null } | null;
  enrollment: { id: string; student: { firstNameEn: string; lastNameEn: string } } | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const admissionsApi = {
  quote: (req: QuoteRequest) =>
    authFetch('/admissions/quote', { method: 'POST', body: JSON.stringify(req) }).then((r) =>
      json<ComputedQuote>(r),
    ),
  commit: (req: CommitRequest) =>
    authFetch('/admissions/commit', { method: 'POST', body: JSON.stringify(req) }).then((r) =>
      json<{ id: string; status: string; studentId: string }>(r),
    ),
  familyCommit: (req: FamilyCommitRequest) =>
    authFetch('/admissions/family/commit', { method: 'POST', body: JSON.stringify(req) }).then(
      (r) =>
        json<{
          financialAccount: { id: string; nameEn: string } | null;
          plan: { id: string; installments: number } | null;
          enrollmentIds: string[];
        }>(r),
    ),
  addFamilyStudent: (financialAccountId: string, req: AddFamilyStudentRequest) =>
    authFetch(`/admissions/family/${financialAccountId}/add-student`, {
      method: 'POST',
      body: JSON.stringify(req),
    }).then((r) => json<{ enrollmentId: string; mode: string; planId: string | null }>(r)),
  loadReturning: (studentId: string) =>
    authFetch(`/admissions/returning/${studentId}`).then((r) => json<ReturningStudent>(r)),
  // Enrollment statistics: participation vs. admission-funnel breakdowns, optionally by academic year.
  enrollmentStats: (academicYearId?: string) =>
    authFetch(
      `/admissions/enrollments/stats${academicYearId ? `?academicYearId=${academicYearId}` : ''}`,
    ).then((r) =>
      json<{
        total: number;
        byStatus: Record<string, number>;
        byAdmissionStatus: Record<string, number>;
      }>(r),
    ),
  // Re-enroll a returning (Case-C) student into a new year via the shared pipeline (no new Student).
  reEnroll: (req: {
    studentId: string;
    quoteId: string;
    idempotencyKey: string;
    financialAccountId?: string;
    mode?: string;
    sectionId?: string;
    areaId?: string;
    transportRequested?: boolean;
    registrationFeePaid?: boolean;
    paymentMode?: string;
    installments?: number;
    firstDueDate?: string;
    confirm?: boolean;
  }) =>
    authFetch('/admissions/reenroll', { method: 'POST', body: JSON.stringify(req) }).then((r) =>
      json<{ enrollmentId: string; mode: string; planId: string | null }>(r),
    ),
  // Identity-first admission lookup (A/B/C). National ID primary, Ministry number fallback.
  identityLookup: (params: { nationalId?: string; moeStudentNumber?: string }) => {
    const sp = new URLSearchParams();
    if (params.nationalId) sp.set('nationalId', params.nationalId);
    if (params.moeStudentNumber) sp.set('moeStudentNumber', params.moeStudentNumber);
    return authFetch(`/admissions/identity/lookup?${sp.toString()}`).then((r) =>
      json<IdentityLookupResult>(r),
    );
  },
  // Informational similar-name warning (never the identity check).
  identitySimilar: (name: string) =>
    authFetch(`/admissions/identity/similar?name=${encodeURIComponent(name)}`).then((r) =>
      json<IdentityStudentSummary[]>(r),
    ),
  listEnrollments: (
    params: {
      academicYearId?: string;
      gradeId?: string;
      status?: string;
      admissionStatus?: string;
    } = {},
  ) => {
    const sp = new URLSearchParams();
    if (params.academicYearId) sp.set('academicYearId', params.academicYearId);
    if (params.gradeId) sp.set('gradeId', params.gradeId);
    if (params.status) sp.set('status', params.status);
    if (params.admissionStatus) sp.set('admissionStatus', params.admissionStatus);
    const qs = sp.toString();
    return authFetch(`/admissions/enrollments${qs ? `?${qs}` : ''}`).then((r) =>
      json<EnrollmentRow[]>(r),
    );
  },

  // ── Fee-item catalog ──
  listFeeItems: () => authFetch('/admissions/fee-items').then((r) => json<FeeItem[]>(r)),
  createFeeItem: (data: {
    kind: FeeItemKind;
    nameEn: string;
    nameAr: string;
    mandatory?: boolean;
    discountable?: boolean;
  }) =>
    authFetch('/admissions/fee-items', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<FeeItem>(r),
    ),
  updateFeeItem: (
    id: string,
    data: {
      nameEn?: string;
      nameAr?: string;
      mandatory?: boolean;
      discountable?: boolean;
      isActive?: boolean;
    },
  ) =>
    authFetch(`/admissions/fee-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(
      (r) => json<FeeItem>(r),
    ),
  listGradeFeeItems: (academicYearId: string, gradeId?: string) => {
    const sp = new URLSearchParams({ academicYearId });
    if (gradeId) sp.set('gradeId', gradeId);
    return authFetch(`/admissions/grade-fee-items?${sp.toString()}`).then((r) =>
      json<GradeFeeItem[]>(r),
    );
  },
  upsertGradeFeeItem: (data: {
    feeItemId: string;
    gradeId: string;
    academicYearId: string;
    amount: number;
    mandatory?: boolean;
    discountable?: boolean;
  }) =>
    authFetch('/admissions/grade-fee-items', { method: 'POST', body: JSON.stringify(data) }).then(
      (r) => json<GradeFeeItem>(r),
    ),

  // ── Approvals ──
  listModifications: (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return authFetch(`/admissions/fee-modifications${qs}`).then((r) =>
      json<FeeModificationRow[]>(r),
    );
  },
  approveModification: (id: string, note?: string) =>
    authFetch(`/admissions/fee-modifications/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ ...(note ? { note } : {}) }),
    }).then((r) => json<{ id: string; status: string }>(r)),
  rejectModification: (id: string, note?: string) =>
    authFetch(`/admissions/fee-modifications/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ ...(note ? { note } : {}) }),
    }).then((r) => json<{ id: string; status: string }>(r)),

  // ── Financial arrangements ──
  createArrangement: (data: { studentId: string; enrollmentId?: string; description: string }) =>
    authFetch('/admissions/arrangements', { method: 'POST', body: JSON.stringify(data) }).then(
      (r) => json<{ id: string }>(r),
    ),
};

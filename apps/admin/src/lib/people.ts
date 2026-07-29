'use client';

import { API_URL, authFetch } from './auth';

export interface Student {
  id: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  // Full Arab/MoE name parts (given · father · grandfather · family).
  fatherNameEn?: string | null;
  fatherNameAr?: string | null;
  thirdNameEn?: string | null;
  thirdNameAr?: string | null;
  nationalId?: string | null;
  moeStudentNumber?: string | null;
  /** Internal, school-generated student number (Decision 6) — permanent, distinct from National/MoE. */
  studentNumber?: string | null;
  sectionId?: string | null;
  /** Home area (geographic); set during registration. Drives Fleet's Area Planning. */
  areaId?: string | null;
  /** Whether the parent requested transportation. Feeds the Fleet Unassigned queue. */
  transportRequested?: boolean;
  dateOfBirth?: string | null;
  gender?: string | null;
  enrollmentDate?: string | null;
  qrCode: string;
  status: string;
}

/** One immutable row of a student's Enrollment History (per academic year). */
export interface EnrollmentHistoryRow {
  id: string;
  admissionStatus: string;
  status: string;
  admissionDate: string | null;
  withdrawalDate: string | null;
  graduationDate: string | null;
  reason: string | null;
  grade: { id: string; nameEn: string; nameAr: string } | null;
  section: { id: string; name: string } | null;
  academicYear: { id: string; name: string; startDate: string; status: string } | null;
}

/** Full English name from its parts: given · father · grandfather · family. */
export function fullNameEn(s: Student): string {
  return [s.firstNameEn, s.fatherNameEn, s.thirdNameEn, s.lastNameEn]
    .filter(Boolean)
    .join(' ')
    .trim();
}

/** Full Arabic name from its parts. */
export function fullNameAr(s: Student): string {
  return [s.firstNameAr, s.fatherNameAr, s.thirdNameAr, s.lastNameAr]
    .filter(Boolean)
    .join(' ')
    .trim();
}

export interface ImportResult {
  created: number;
  failed: Array<{ row: number; error: string }>;
}

export interface StudentVaccine {
  id: string;
  studentId: string;
  name: string;
  grade?: string | null;
  received: boolean;
  dateGiven?: string | null;
  notes?: string | null;
}

export interface UpsertVaccineInput {
  name: string;
  grade?: string;
  received?: boolean;
  dateGiven?: string;
  notes?: string;
}

export interface UpdateStudentInput {
  firstNameEn?: string;
  lastNameEn?: string;
  firstNameAr?: string;
  lastNameAr?: string;
  fatherNameEn?: string;
  fatherNameAr?: string;
  thirdNameEn?: string;
  thirdNameAr?: string;
  nationalId?: string;
  moeStudentNumber?: string;
  sectionId?: string;
  areaId?: string;
  transportRequested?: boolean;
  gender?: string;
  dateOfBirth?: string;
  status?: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const studentsApi = {
  list: (search?: string) =>
    authFetch(`/students${search ? `?search=${encodeURIComponent(search)}` : ''}`).then((r) =>
      json<Student[]>(r),
    ),
  /** Load a single student by id — backs the full-page Student Profile header. */
  get: (id: string) => authFetch(`/students/${id}`).then((r) => json<Student>(r)),
  bySection: (sectionId: string) =>
    authFetch(`/students?sectionId=${sectionId}`).then((r) => json<Student[]>(r)),
  // Immutable per-year Enrollment History (year · grade · status · dates).
  enrollmentHistory: (id: string) =>
    authFetch(`/students/${id}/enrollment-history`).then((r) => json<EnrollmentHistoryRow[]>(r)),
  // Whether the student can be hard-deleted (else the UI offers Withdraw / Cancel Admission).
  deletability: (id: string) =>
    authFetch(`/students/${id}/deletability`).then((r) =>
      json<{ deletable: boolean; blockers: string[] }>(r),
    ),
  create: (data: {
    firstNameEn: string;
    lastNameEn: string;
    firstNameAr: string;
    lastNameAr: string;
    fatherNameEn?: string;
    fatherNameAr?: string;
    thirdNameEn?: string;
    thirdNameAr?: string;
    nationalId?: string;
    moeStudentNumber?: string;
    sectionId?: string;
    gender?: string;
    dateOfBirth?: string;
  }) =>
    authFetch('/students', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<Student>(r),
    ),
  import: (csv: string) =>
    authFetch('/students/import', { method: 'POST', body: JSON.stringify({ csv }) }).then((r) =>
      json<ImportResult>(r),
    ),
  update: (id: string, data: UpdateStudentInput) =>
    authFetch(`/students/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<Student>(r),
    ),
  remove: (id: string) => del(`/students/${id}`),

  // ----- Parents -----------------------------------------------------------
  parents: (studentId: string) =>
    authFetch(`/students/${studentId}/parents`).then((r) => json<StudentParentLink[]>(r)),
  linkParent: (
    studentId: string,
    data: { parentId: string; relation: string; isPrimary?: boolean },
  ) =>
    authFetch(`/students/${studentId}/parents`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json(r)),
  unlinkParent: (studentId: string, parentId: string) =>
    del(`/students/${studentId}/parents/${parentId}`),

  // ----- Vaccines ----------------------------------------------------------
  vaccines: (studentId: string) =>
    authFetch(`/students/${studentId}/vaccines`).then((r) => json<StudentVaccine[]>(r)),
  addVaccine: (studentId: string, data: UpsertVaccineInput) =>
    authFetch(`/students/${studentId}/vaccines`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<StudentVaccine>(r)),
  updateVaccine: (studentId: string, vaccineId: string, data: Partial<UpsertVaccineInput>) =>
    authFetch(`/students/${studentId}/vaccines/${vaccineId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => json<StudentVaccine>(r)),
  removeVaccine: (studentId: string, vaccineId: string) =>
    del(`/students/${studentId}/vaccines/${vaccineId}`),
};

// ---------------------------------------------------------------------------
// Staff & guardians (teachers / parents / employees)
// ---------------------------------------------------------------------------

/** Full employee lifecycle (mirrors the Prisma EmploymentStatus enum). */
export type EmploymentStatus =
  | 'CANDIDATE'
  | 'INTERVIEW'
  | 'OFFER_SENT'
  | 'BACKGROUND_CHECK'
  | 'OFFER_ACCEPTED'
  | 'HIRED'
  | 'PROBATION'
  | 'ACTIVE'
  | 'TRANSFERRED'
  | 'PROMOTION'
  | 'ON_LEAVE'
  | 'SUSPENDED'
  | 'RETIRED'
  | 'RESIGNED'
  | 'TERMINATED'
  | 'ARCHIVED';

/** The three basic statuses used by Teacher records and simple pickers. */
export const EMPLOYMENT_STATUSES: EmploymentStatus[] = ['ACTIVE', 'ON_LEAVE', 'TERMINATED'];

/** Every lifecycle status, in canonical order (badges, filters, timelines). */
export const EMPLOYEE_STATUSES: EmploymentStatus[] = [
  'CANDIDATE',
  'INTERVIEW',
  'OFFER_SENT',
  'BACKGROUND_CHECK',
  'OFFER_ACCEPTED',
  'HIRED',
  'PROBATION',
  'ACTIVE',
  'TRANSFERRED',
  'PROMOTION',
  'ON_LEAVE',
  'SUSPENDED',
  'RETIRED',
  'RESIGNED',
  'TERMINATED',
  'ARCHIVED',
];

/** Statuses an employee may be created at directly (mirrors the server state machine). */
export const EMPLOYEE_ENTRY_STATUSES: EmploymentStatus[] = [
  'CANDIDATE',
  'HIRED',
  'PROBATION',
  'ACTIVE',
];

/**
 * Allowed single-step transitions per status — a client mirror of the server state machine
 * (apps/api/.../employee-lifecycle.logic.ts) used only to constrain the status picker. The server
 * remains the source of truth and re-validates every transition.
 */
export const EMPLOYEE_STATUS_TRANSITIONS: Record<EmploymentStatus, EmploymentStatus[]> = {
  CANDIDATE: ['INTERVIEW', 'ARCHIVED'],
  INTERVIEW: ['OFFER_SENT', 'ARCHIVED'],
  OFFER_SENT: ['OFFER_ACCEPTED', 'BACKGROUND_CHECK', 'ARCHIVED'],
  OFFER_ACCEPTED: ['BACKGROUND_CHECK', 'HIRED', 'ARCHIVED'],
  BACKGROUND_CHECK: ['HIRED', 'ARCHIVED'],
  HIRED: ['PROBATION', 'ACTIVE'],
  PROBATION: ['ACTIVE', 'TERMINATED', 'RESIGNED'],
  ACTIVE: [
    'ON_LEAVE',
    'SUSPENDED',
    'TRANSFERRED',
    'PROMOTION',
    'RESIGNED',
    'RETIRED',
    'TERMINATED',
  ],
  TRANSFERRED: ['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED'],
  PROMOTION: ['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED'],
  ON_LEAVE: ['ACTIVE', 'SUSPENDED', 'RESIGNED', 'RETIRED', 'TERMINATED'],
  SUSPENDED: ['ACTIVE', 'TERMINATED', 'RESIGNED'],
  RETIRED: ['ARCHIVED'],
  RESIGNED: ['ARCHIVED'],
  TERMINATED: ['ARCHIVED'],
  ARCHIVED: [],
};

export type EmploymentType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'CONTRACT'
  | 'HOURLY'
  | 'SEASONAL'
  | 'CONSULTANT'
  | 'SUBSTITUTE'
  | 'INTERN'
  | 'VOLUNTEER';

export const EMPLOYMENT_TYPES: EmploymentType[] = [
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'HOURLY',
  'SEASONAL',
  'CONSULTANT',
  'SUBSTITUTE',
  'INTERN',
  'VOLUNTEER',
];

export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED' | 'OTHER';
export const MARITAL_STATUSES: MaritalStatus[] = [
  'SINGLE',
  'MARRIED',
  'DIVORCED',
  'WIDOWED',
  'OTHER',
];

export type Gender = 'MALE' | 'FEMALE';

/** DELETE helper — endpoints reply 204 No Content, so there is no body to parse. */
async function del(path: string): Promise<void> {
  const res = await authFetch(path, { method: 'DELETE' });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
}

export interface Teacher {
  id: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  employeeNumber?: string | null;
  specialization?: string | null;
  status: EmploymentStatus;
}

export interface CreateTeacherInput {
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  employeeNumber?: string;
  specialization?: string;
  status?: EmploymentStatus;
}

export const teachersApi = {
  list: () => authFetch('/teachers').then((r) => json<Teacher[]>(r)),
  create: (data: CreateTeacherInput) =>
    authFetch('/teachers', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<Teacher>(r),
    ),
  remove: (id: string) => del(`/teachers/${id}`),
};

export interface Parent {
  id: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  phone?: string | null;
  phoneAlt?: string | null;
  email?: string | null;
  nationalId?: string | null;
  occupation?: string | null;
}

export interface CreateParentInput {
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  phone: string;
  phoneAlt?: string;
  email?: string;
  nationalId?: string;
  occupation?: string;
}

export interface UpdateParentInput {
  firstNameEn?: string;
  lastNameEn?: string;
  firstNameAr?: string;
  lastNameAr?: string;
  phone?: string;
  phoneAlt?: string;
  email?: string;
  nationalId?: string;
  occupation?: string;
}

/** A parent linked to a student, with the relation/primary flag from the join. */
export interface StudentParentLink {
  id: string;
  relation: string;
  isPrimary: boolean;
  parent: Parent;
}

export const parentsApi = {
  list: (studentId?: string) =>
    authFetch(`/parents${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''}`).then(
      (r) => json<Parent[]>(r),
    ),
  create: (data: CreateParentInput) =>
    authFetch('/parents', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<Parent>(r),
    ),
  update: (id: string, data: UpdateParentInput) =>
    authFetch(`/parents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<Parent>(r),
    ),
  remove: (id: string) => del(`/parents/${id}`),
};

export interface DepartmentRef {
  id: string;
  name: string;
}
export interface PositionRef {
  id: string;
  title: string;
}
export interface CampusRef {
  id: string;
  nameEn: string;
  nameAr: string;
}
export interface EmployeeManagerRef {
  id: string;
  firstNameEn: string;
  lastNameEn: string;
}
export interface EmployeeTeacherRef {
  id: string;
  specialization?: string | null;
}

/** One lifecycle transition in an employee's status timeline. */
export interface EmployeeStatusRow {
  id: string;
  fromStatus: EmploymentStatus | null;
  toStatus: EmploymentStatus;
  reason?: string | null;
  effectiveDate?: string | null;
  createdAt: string;
  actor?: {
    id: string;
    firstNameEn?: string | null;
    lastNameEn?: string | null;
    email?: string | null;
  } | null;
}

export interface Employee {
  id: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  jobTitle: string;
  employeeNumber?: string | null;
  nationalId?: string | null;
  passportNumber?: string | null;
  nationality?: string | null;
  visaNumber?: string | null;
  visaExpiry?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  maritalStatus?: MaritalStatus | null;
  religion?: string | null;
  personalEmail?: string | null;
  personalPhone?: string | null;
  photoUrl?: string | null;
  employmentType?: EmploymentType | null;
  status: EmploymentStatus;
  hireDate?: string | null;
  probationEndDate?: string | null;
  terminationDate?: string | null;
  workingHoursPerWeek?: string | number | null;
  campusId?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  managerId?: string | null;
  department?: DepartmentRef | null;
  position?: PositionRef | null;
  campus?: CampusRef | null;
  manager?: EmployeeManagerRef | null;
  teacher?: EmployeeTeacherRef | null;
  statusHistory?: EmployeeStatusRow[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CreateEmployeeInput {
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  jobTitle: string;
  employeeNumber?: string;
  nationalId?: string;
  passportNumber?: string;
  nationality?: string;
  visaNumber?: string;
  visaExpiry?: string;
  gender?: Gender;
  dateOfBirth?: string;
  maritalStatus?: MaritalStatus;
  religion?: string;
  personalEmail?: string;
  personalPhone?: string;
  employmentType?: EmploymentType;
  status?: EmploymentStatus;
  hireDate?: string;
  probationEndDate?: string;
  workingHoursPerWeek?: number;
  campusId?: string;
  departmentId?: string;
  positionId?: string;
  managerId?: string;
}

export type UpdateEmployeeInput = Partial<Omit<CreateEmployeeInput, 'status'>>;

export interface EmployeeListFilters {
  q?: string;
  status?: EmploymentStatus;
  departmentId?: string;
  campusId?: string;
  positionId?: string;
  includeInactive?: boolean;
}

export interface TransitionStatusInput {
  toStatus: EmploymentStatus;
  reason?: string;
  effectiveDate?: string;
}

function employeeQuery(filters?: EmployeeListFilters): string {
  if (!filters) return '';
  const p = new URLSearchParams();
  if (filters.q) p.set('q', filters.q);
  if (filters.status) p.set('status', filters.status);
  if (filters.departmentId) p.set('departmentId', filters.departmentId);
  if (filters.campusId) p.set('campusId', filters.campusId);
  if (filters.positionId) p.set('positionId', filters.positionId);
  if (filters.includeInactive) p.set('includeInactive', 'true');
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

export const employeesApi = {
  list: (filters?: EmployeeListFilters) =>
    authFetch(`/employees${employeeQuery(filters)}`).then((r) => json<Employee[]>(r)),
  get: (id: string) => authFetch(`/employees/${id}`).then((r) => json<Employee>(r)),
  create: (data: CreateEmployeeInput) =>
    authFetch('/employees', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<Employee>(r),
    ),
  update: (id: string, data: UpdateEmployeeInput) =>
    authFetch(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<Employee>(r),
    ),
  transitionStatus: (id: string, data: TransitionStatusInput) =>
    authFetch(`/employees/${id}/status`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<Employee>(r),
    ),
  statusHistory: (id: string) =>
    authFetch(`/employees/${id}/status-history`).then((r) => json<EmployeeStatusRow[]>(r)),
  remove: (id: string) => del(`/employees/${id}`),
};

// ---------------------------------------------------------------------------
// Organisation engine (departments & positions)
// ---------------------------------------------------------------------------

export interface Department {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  campusId?: string | null;
  parentId?: string | null;
  headEmployeeId?: string | null;
  isActive: boolean;
  headcount?: number;
  campus?: CampusRef | null;
  parent?: DepartmentRef | null;
  head?: EmployeeManagerRef | null;
}

export interface CreateDepartmentInput {
  name: string;
  code?: string;
  description?: string;
  campusId?: string;
  parentId?: string;
  headEmployeeId?: string;
  isActive?: boolean;
}
export type UpdateDepartmentInput = Partial<CreateDepartmentInput>;

export interface Position {
  id: string;
  title: string;
  code?: string | null;
  description?: string | null;
  departmentId?: string | null;
  budgetedHeadcount?: number | null;
  isActive: boolean;
  filled?: number;
  vacancies?: number | null;
  department?: DepartmentRef | null;
}

export interface CreatePositionInput {
  title: string;
  code?: string;
  description?: string;
  departmentId?: string;
  budgetedHeadcount?: number;
  isActive?: boolean;
}
export type UpdatePositionInput = Partial<CreatePositionInput>;

export const departmentsApi = {
  list: () => authFetch('/hr/departments').then((r) => json<Department[]>(r)),
  create: (data: CreateDepartmentInput) =>
    authFetch('/hr/departments', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<Department>(r),
    ),
  update: (id: string, data: UpdateDepartmentInput) =>
    authFetch(`/hr/departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<Department>(r),
    ),
  remove: (id: string) => del(`/hr/departments/${id}`),
};

export const positionsApi = {
  list: () => authFetch('/hr/positions').then((r) => json<Position[]>(r)),
  create: (data: CreatePositionInput) =>
    authFetch('/hr/positions', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<Position>(r),
    ),
  update: (id: string, data: UpdatePositionInput) =>
    authFetch(`/hr/positions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<Position>(r),
    ),
  remove: (id: string) => del(`/hr/positions/${id}`),
};

// ---------------------------------------------------------------------------
// HR Phase 2 — contracts, documents & personal sub-records (employee-scoped)
// ---------------------------------------------------------------------------

export type ContractType =
  | 'PERMANENT'
  | 'TEMPORARY'
  | 'PART_TIME'
  | 'HOURLY'
  | 'SEASONAL'
  | 'CONSULTANT'
  | 'SUBSTITUTE_TEACHER';
export const CONTRACT_TYPES: ContractType[] = [
  'PERMANENT',
  'TEMPORARY',
  'PART_TIME',
  'HOURLY',
  'SEASONAL',
  'CONSULTANT',
  'SUBSTITUTE_TEACHER',
];

export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'RENEWED';
export const CONTRACT_STATUSES: ContractStatus[] = [
  'DRAFT',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
  'RENEWED',
];

export interface ContractAllowance {
  name: string;
  amount: number;
}

export interface Contract {
  id: string;
  employeeId: string;
  contractType: ContractType;
  status: ContractStatus;
  title?: string | null;
  startDate: string;
  endDate?: string | null;
  baseSalary?: string | number | null;
  currency?: string | null;
  allowances?: ContractAllowance[] | null;
  benefits?: string | null;
  workingHours?: string | number | null;
  vacationDays?: number | null;
  signedDocumentId?: string | null;
  renewedFromId?: string | null;
  notes?: string | null;
}

export interface ContractInput {
  contractType: ContractType;
  title?: string;
  startDate: string;
  endDate?: string;
  baseSalary?: number;
  currency?: string;
  allowances?: ContractAllowance[];
  benefits?: string;
  workingHours?: number;
  vacationDays?: number;
  signedDocumentId?: string;
  notes?: string;
}

export const contractsApi = {
  list: (employeeId: string) =>
    authFetch(`/employees/${employeeId}/contracts`).then((r) => json<Contract[]>(r)),
  create: (employeeId: string, data: ContractInput) =>
    authFetch(`/employees/${employeeId}/contracts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<Contract>(r)),
  update: (
    employeeId: string,
    id: string,
    data: Partial<ContractInput> & { status?: ContractStatus },
  ) =>
    authFetch(`/employees/${employeeId}/contracts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => json<Contract>(r)),
  renew: (employeeId: string, id: string, data: ContractInput) =>
    authFetch(`/employees/${employeeId}/contracts/${id}/renew`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<Contract>(r)),
  remove: (employeeId: string, id: string) => del(`/employees/${employeeId}/contracts/${id}`),
};

export type EmployeeDocumentType =
  | 'CONTRACT'
  | 'NATIONAL_ID'
  | 'PASSPORT'
  | 'CERTIFICATE'
  | 'MEDICAL_REPORT'
  | 'POLICE_CLEARANCE'
  | 'DRIVING_LICENSE'
  | 'INSURANCE'
  | 'TRAINING_CERTIFICATE'
  | 'OTHER';
export const EMPLOYEE_DOCUMENT_TYPES: EmployeeDocumentType[] = [
  'CONTRACT',
  'NATIONAL_ID',
  'PASSPORT',
  'CERTIFICATE',
  'MEDICAL_REPORT',
  'POLICE_CLEARANCE',
  'DRIVING_LICENSE',
  'INSURANCE',
  'TRAINING_CERTIFICATE',
  'OTHER',
];

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  type: EmployeeDocumentType;
  title: string;
  fileName: string;
  contentType: string;
  size: number;
  version: number;
  supersedesId?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  downloadUrl: string;
  createdAt: string;
}

export interface PresignedUpload {
  uploadUrl: string;
  fileKey: string;
}

export const employeeDocumentsApi = {
  list: (employeeId: string) =>
    authFetch(`/employees/${employeeId}/documents`).then((r) => json<EmployeeDocument[]>(r)),
  presign: (employeeId: string, data: { fileName: string; contentType: string; size: number }) =>
    authFetch(`/employees/${employeeId}/documents/presign`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<PresignedUpload>(r)),
  create: (
    employeeId: string,
    data: {
      type: EmployeeDocumentType;
      title: string;
      fileKey: string;
      fileName: string;
      contentType: string;
      size: number;
      issueDate?: string;
      expiryDate?: string;
      supersedesId?: string;
    },
  ) =>
    authFetch(`/employees/${employeeId}/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<EmployeeDocument>(r)),
  downloadUrl: (employeeId: string, id: string) =>
    authFetch(`/employees/${employeeId}/documents/${id}/download`).then((r) =>
      json<{ url: string }>(r),
    ),
  remove: (employeeId: string, id: string) => del(`/employees/${employeeId}/documents/${id}`),
};

export interface EmergencyContact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  phoneAlt?: string | null;
  email?: string | null;
  address?: string | null;
  isPrimary: boolean;
}
export type DependentRelation = 'SPOUSE' | 'CHILD' | 'PARENT' | 'SIBLING' | 'OTHER';
export const DEPENDENT_RELATIONS: DependentRelation[] = [
  'SPOUSE',
  'CHILD',
  'PARENT',
  'SIBLING',
  'OTHER',
];
export interface Dependent {
  id: string;
  name: string;
  relation: DependentRelation;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  nationalId?: string | null;
  notes?: string | null;
}
export interface EmployeeEducation {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  grade?: string | null;
  notes?: string | null;
}
export interface Certificate {
  id: string;
  name: string;
  issuingBody?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  credentialId?: string | null;
  documentId?: string | null;
}
export interface BankAccount {
  id: string;
  bankName: string;
  accountName?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  swift?: string | null;
  currency?: string | null;
  isPrimary: boolean;
}

/** Generic employee-scoped sub-resource CRUD client factory (one source of truth). */
function subResource<T, C extends Record<string, unknown>>(resource: string) {
  return {
    list: (employeeId: string) =>
      authFetch(`/employees/${employeeId}/${resource}`).then((r) => json<T[]>(r)),
    create: (employeeId: string, data: C) =>
      authFetch(`/employees/${employeeId}/${resource}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((r) => json<T>(r)),
    update: (employeeId: string, id: string, data: Partial<C>) =>
      authFetch(`/employees/${employeeId}/${resource}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).then((r) => json<T>(r)),
    remove: (employeeId: string, id: string) => del(`/employees/${employeeId}/${resource}/${id}`),
  };
}

export const emergencyContactsApi = subResource<EmergencyContact, Record<string, unknown>>(
  'emergency-contacts',
);
export const dependentsApi = subResource<Dependent, Record<string, unknown>>('dependents');
export const educationApi = subResource<EmployeeEducation, Record<string, unknown>>('education');
export const certificatesApi = subResource<Certificate, Record<string, unknown>>('certificates');
export const bankAccountsApi = subResource<BankAccount, Record<string, unknown>>('bank-accounts');

// ---------------------------------------------------------------------------
// HR Phase 3 — driver profile (employee-scoped): licence, medical, infractions
// ---------------------------------------------------------------------------

export type InfractionSeverity = 'MINOR' | 'MAJOR' | 'SEVERE';
export const INFRACTION_SEVERITIES: InfractionSeverity[] = ['MINOR', 'MAJOR', 'SEVERE'];

export interface DriverInfraction {
  id: string;
  date: string;
  type: string;
  description?: string | null;
  severity: InfractionSeverity;
  points?: number | null;
}

export interface DriverProfile {
  id: string;
  employeeId: string;
  licenseNumber?: string | null;
  licenseClass?: string | null;
  licenseExpiry?: string | null;
  medicalCertExpiry?: string | null;
  medicalNotes?: string | null;
  performanceRating?: number | null;
  notes?: string | null;
  infractions: DriverInfraction[];
}

export interface UpsertDriverProfileInput {
  licenseNumber?: string;
  licenseClass?: string;
  licenseExpiry?: string;
  medicalCertExpiry?: string;
  medicalNotes?: string;
  performanceRating?: number;
  notes?: string;
}

export interface CreateInfractionInput {
  date: string;
  type: string;
  description?: string;
  severity?: InfractionSeverity;
  points?: number;
}

export const driverProfileApi = {
  get: (employeeId: string) =>
    authFetch(`/employees/${employeeId}/driver-profile`).then((r) => json<DriverProfile>(r)),
  upsert: (employeeId: string, data: UpsertDriverProfileInput) =>
    authFetch(`/employees/${employeeId}/driver-profile`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then((r) => json<DriverProfile>(r)),
  remove: (employeeId: string) => del(`/employees/${employeeId}/driver-profile`),
  addInfraction: (employeeId: string, data: CreateInfractionInput) =>
    authFetch(`/employees/${employeeId}/driver-profile/infractions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<DriverInfraction>(r)),
  updateInfraction: (employeeId: string, id: string, data: Partial<CreateInfractionInput>) =>
    authFetch(`/employees/${employeeId}/driver-profile/infractions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => json<DriverInfraction>(r)),
  removeInfraction: (employeeId: string, id: string) =>
    del(`/employees/${employeeId}/driver-profile/infractions/${id}`),
};

// ---------------------------------------------------------------------------
// HR Phase 4 — staff leave (types, balances, requests, approvals)
// ---------------------------------------------------------------------------

export type StaffLeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export const STAFF_LEAVE_STATUSES: StaffLeaveStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
];

export interface LeaveType {
  id: string;
  name: string;
  code?: string | null;
  paid: boolean;
  defaultAnnualDays?: number | null;
  approvalLevels: number;
  colorHex?: string | null;
  isActive: boolean;
}
export interface CreateLeaveTypeInput {
  name: string;
  code?: string;
  paid?: boolean;
  defaultAnnualDays?: number;
  approvalLevels?: number;
  colorHex?: string;
  isActive?: boolean;
}

export interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  year: number;
  entitledDays: string | number;
  usedDays: string | number;
  leaveType: LeaveType;
}

export interface LeaveApproval {
  id: string;
  level: number;
  decision: 'APPROVED' | 'REJECTED';
  note?: string | null;
  decidedAt: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  workingDays: string | number;
  reason?: string | null;
  status: StaffLeaveStatus;
  currentLevel: number;
  requiredLevels: number;
  leaveType: { id: string; name: string; paid: boolean };
  employee: { id: string; firstNameEn: string; lastNameEn: string };
  approvals: LeaveApproval[];
}

export interface CreateLeaveRequestInput {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export const leaveApi = {
  listTypes: () => authFetch('/hr/leave-types').then((r) => json<LeaveType[]>(r)),
  createType: (data: CreateLeaveTypeInput) =>
    authFetch('/hr/leave-types', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<LeaveType>(r),
    ),
  updateType: (id: string, data: Partial<CreateLeaveTypeInput>) =>
    authFetch(`/hr/leave-types/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<LeaveType>(r),
    ),
  removeType: (id: string) => del(`/hr/leave-types/${id}`),

  listRequests: (params?: { status?: StaffLeaveStatus }) =>
    authFetch(`/hr/leave-requests${params?.status ? `?status=${params.status}` : ''}`).then((r) =>
      json<LeaveRequest[]>(r),
    ),
  approve: (id: string, note?: string) =>
    authFetch(`/hr/leave-requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(note ? { note } : {}),
    }).then((r) => json<LeaveRequest>(r)),
  reject: (id: string, note?: string) =>
    authFetch(`/hr/leave-requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(note ? { note } : {}),
    }).then((r) => json<LeaveRequest>(r)),
  cancel: (id: string) =>
    authFetch(`/hr/leave-requests/${id}/cancel`, { method: 'POST', body: '{}' }).then((r) =>
      json<LeaveRequest>(r),
    ),

  // Employee-scoped
  balances: (employeeId: string) =>
    authFetch(`/employees/${employeeId}/leave-balances`).then((r) => json<LeaveBalance[]>(r)),
  setBalance: (
    employeeId: string,
    data: { leaveTypeId: string; year: number; entitledDays: number },
  ) =>
    authFetch(`/employees/${employeeId}/leave-balances`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<LeaveBalance>(r)),
  employeeRequests: (employeeId: string) =>
    authFetch(`/employees/${employeeId}/leave-requests`).then((r) => json<LeaveRequest[]>(r)),
  createRequest: (employeeId: string, data: CreateLeaveRequestInput) =>
    authFetch(`/employees/${employeeId}/leave-requests`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<LeaveRequest>(r)),
};

// --- HR Phase 5: staff attendance & payroll preparation ----------------------
export type StaffAttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'LATE'
  | 'EARLY_DEPARTURE'
  | 'ON_LEAVE'
  | 'HOLIDAY'
  | 'REMOTE';
export const STAFF_ATTENDANCE_STATUSES: StaffAttendanceStatus[] = [
  'PRESENT',
  'ABSENT',
  'LATE',
  'EARLY_DEPARTURE',
  'ON_LEAVE',
  'HOLIDAY',
  'REMOTE',
];

export type StaffAttendanceSource = 'MANUAL' | 'QR' | 'BIOMETRIC' | 'GPS' | 'MOBILE';

export interface StaffAttendance {
  id: string;
  employeeId: string;
  date: string;
  status: StaffAttendanceStatus;
  source: StaffAttendanceSource;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number | null;
  overtimeHours: string | number | null;
  note: string | null;
  correctedFromStatus: StaffAttendanceStatus | null;
  correctedAt: string | null;
  employee: { id: string; firstNameEn: string; lastNameEn: string; employeeNumber: string | null };
}

export interface RecordAttendanceInput {
  date: string;
  status: StaffAttendanceStatus;
  source?: StaffAttendanceSource;
  checkInAt?: string;
  checkOutAt?: string;
  lateMinutes?: number;
  overtimeHours?: number;
  note?: string;
}

export interface PayrollPrepRow {
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  workingDays: number;
  presentDays: number;
  remoteDays: number;
  absentDays: number;
  lateDays: number;
  lateMinutes: number;
  overtimeHours: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  payableDays: number;
}

export interface PayrollPrepResult {
  from: string;
  to: string;
  workingDays: number;
  rows: PayrollPrepRow[];
}

export const attendanceApi = {
  listForEmployee: (employeeId: string, range?: { from?: string; to?: string }) => {
    const p = new URLSearchParams();
    if (range?.from) p.set('from', range.from);
    if (range?.to) p.set('to', range.to);
    const qs = p.toString();
    return authFetch(`/employees/${employeeId}/attendance${qs ? `?${qs}` : ''}`).then((r) =>
      json<StaffAttendance[]>(r),
    );
  },
  record: (employeeId: string, data: RecordAttendanceInput) =>
    authFetch(`/employees/${employeeId}/attendance`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<StaffAttendance>(r)),

  daily: (date: string) =>
    authFetch(`/hr/attendance?date=${encodeURIComponent(date)}`).then((r) =>
      json<StaffAttendance[]>(r),
    ),
  bulk: (
    date: string,
    entries: Array<{ employeeId: string; status: StaffAttendanceStatus }>,
    source?: StaffAttendanceSource,
  ) =>
    authFetch('/hr/attendance/bulk', {
      method: 'POST',
      body: JSON.stringify({ date, ...(source ? { source } : {}), entries }),
    }).then((r) => json<{ count: number }>(r)),

  payrollPrep: (from: string, to: string) =>
    authFetch(`/hr/payroll-prep?from=${from}&to=${to}`).then((r) => json<PayrollPrepResult>(r)),

  /** Trigger a browser download of the payroll-prep export (cookie session). */
  async downloadPayrollPrep(
    from: string,
    to: string,
    format: 'csv' | 'xlsx' | 'pdf',
  ): Promise<void> {
    const res = await fetch(`${API_URL}/hr/payroll-prep?from=${from}&to=${to}&format=${format}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') ?? '';
    const match = /filename="([^"]+)"/.exec(disposition);
    const filename = match?.[1] ?? `payroll-prep.${format}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

// --- HR Phase 6: performance management --------------------------------------
export type PerformanceCycleStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';
export const PERFORMANCE_CYCLE_STATUSES: PerformanceCycleStatus[] = ['DRAFT', 'ACTIVE', 'CLOSED'];
export type PerformanceReviewStatus = 'DRAFT' | 'SUBMITTED' | 'ACKNOWLEDGED';
export type PerformanceGoalStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export const PERFORMANCE_GOAL_STATUSES: PerformanceGoalStatus[] = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

export interface PerformanceCycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PerformanceCycleStatus;
}

export interface PerformanceGoal {
  id: string;
  reviewId: string;
  title: string;
  description: string | null;
  weight: number;
  progress: number;
  status: PerformanceGoalStatus;
  rating: number | null;
  dueDate: string | null;
}

export interface PerformanceReview {
  id: string;
  cycleId: string;
  employeeId: string;
  status: PerformanceReviewStatus;
  overallRating: number | null;
  summary: string | null;
  strengths: string | null;
  improvements: string | null;
  submittedAt: string | null;
  acknowledgedAt: string | null;
  cycle: { id: string; name: string; status: PerformanceCycleStatus };
  employee: { id: string; firstNameEn: string; lastNameEn: string };
  goals: PerformanceGoal[];
}

export const performanceApi = {
  listCycles: () => authFetch('/hr/performance-cycles').then((r) => json<PerformanceCycle[]>(r)),
  createCycle: (data: {
    name: string;
    startDate: string;
    endDate: string;
    status?: PerformanceCycleStatus;
  }) =>
    authFetch('/hr/performance-cycles', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<PerformanceCycle>(r),
    ),
  updateCycle: (id: string, data: Partial<{ name: string; status: PerformanceCycleStatus }>) =>
    authFetch(`/hr/performance-cycles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => json<PerformanceCycle>(r)),
  removeCycle: (id: string) => del(`/hr/performance-cycles/${id}`),

  listReviews: (employeeId: string) =>
    authFetch(`/employees/${employeeId}/performance-reviews`).then((r) =>
      json<PerformanceReview[]>(r),
    ),
  createReview: (employeeId: string, cycleId: string) =>
    authFetch(`/employees/${employeeId}/performance-reviews`, {
      method: 'POST',
      body: JSON.stringify({ cycleId }),
    }).then((r) => json<PerformanceReview>(r)),
  updateReview: (
    id: string,
    data: Partial<{
      overallRating: number;
      summary: string;
      strengths: string;
      improvements: string;
    }>,
  ) =>
    authFetch(`/hr/performance-reviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => json<PerformanceReview>(r)),
  submitReview: (id: string) =>
    authFetch(`/hr/performance-reviews/${id}/submit`, { method: 'POST', body: '{}' }).then((r) =>
      json<PerformanceReview>(r),
    ),
  acknowledgeReview: (id: string) =>
    authFetch(`/hr/performance-reviews/${id}/acknowledge`, { method: 'POST', body: '{}' }).then(
      (r) => json<PerformanceReview>(r),
    ),

  addGoal: (
    reviewId: string,
    data: { title: string; description?: string; weight?: number; dueDate?: string },
  ) =>
    authFetch(`/hr/performance-reviews/${reviewId}/goals`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<PerformanceGoal>(r)),
  updateGoal: (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      weight: number;
      progress: number;
      status: PerformanceGoalStatus;
      rating: number;
      dueDate: string;
    }>,
  ) =>
    authFetch(`/hr/performance-goals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => json<PerformanceGoal>(r)),
  removeGoal: (id: string) => del(`/hr/performance-goals/${id}`),
};

// --- HR Phase 6: training ----------------------------------------------------
export type TrainingRecordStatus =
  | 'ENROLLED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';
export const TRAINING_RECORD_STATUSES: TrainingRecordStatus[] = [
  'ENROLLED',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
];

export interface TrainingCourse {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  provider: string | null;
  hours: string | number | null;
  mandatory: boolean;
  isActive: boolean;
}

export interface TrainingRecord {
  id: string;
  courseId: string;
  employeeId: string;
  status: TrainingRecordStatus;
  enrolledAt: string;
  completedAt: string | null;
  score: string | number | null;
  expiresAt: string | null;
  note: string | null;
  course: { id: string; title: string; mandatory: boolean };
  employee: { id: string; firstNameEn: string; lastNameEn: string };
}

export const trainingApi = {
  listCourses: () => authFetch('/hr/training-courses').then((r) => json<TrainingCourse[]>(r)),
  createCourse: (data: {
    title: string;
    description?: string;
    category?: string;
    provider?: string;
    hours?: number;
    mandatory?: boolean;
    isActive?: boolean;
  }) =>
    authFetch('/hr/training-courses', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<TrainingCourse>(r),
    ),
  updateCourse: (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      category: string;
      provider: string;
      hours: number;
      mandatory: boolean;
      isActive: boolean;
    }>,
  ) =>
    authFetch(`/hr/training-courses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => json<TrainingCourse>(r)),
  removeCourse: (id: string) => del(`/hr/training-courses/${id}`),

  listForEmployee: (employeeId: string) =>
    authFetch(`/employees/${employeeId}/training-records`).then((r) => json<TrainingRecord[]>(r)),
  enroll: (employeeId: string, courseId: string) =>
    authFetch(`/employees/${employeeId}/training-records`, {
      method: 'POST',
      body: JSON.stringify({ courseId }),
    }).then((r) => json<TrainingRecord>(r)),
  updateRecord: (
    id: string,
    data: Partial<{
      status: TrainingRecordStatus;
      completedAt: string;
      score: number;
      expiresAt: string;
      certificateId: string;
      note: string;
    }>,
  ) =>
    authFetch(`/hr/training-records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => json<TrainingRecord>(r)),
  removeRecord: (id: string) => del(`/hr/training-records/${id}`),
  expiring: (within = 90) =>
    authFetch(`/hr/training-records/expiring?within=${within}`).then((r) =>
      json<TrainingRecord[]>(r),
    ),
};

// --- HR Phase 7: asset management --------------------------------------------
export type AssetCategory =
  | 'LAPTOP'
  | 'DESKTOP'
  | 'PHONE'
  | 'TABLET'
  | 'VEHICLE'
  | 'KEY'
  | 'UNIFORM'
  | 'FURNITURE'
  | 'EQUIPMENT'
  | 'OTHER';
export const ASSET_CATEGORIES: AssetCategory[] = [
  'LAPTOP',
  'DESKTOP',
  'PHONE',
  'TABLET',
  'VEHICLE',
  'KEY',
  'UNIFORM',
  'FURNITURE',
  'EQUIPMENT',
  'OTHER',
];
export type AssetStatus = 'AVAILABLE' | 'ASSIGNED' | 'IN_REPAIR' | 'RETIRED' | 'LOST';
export const ASSET_STATUSES: AssetStatus[] = [
  'AVAILABLE',
  'ASSIGNED',
  'IN_REPAIR',
  'RETIRED',
  'LOST',
];
export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
export const ASSET_CONDITIONS: AssetCondition[] = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];

export interface Asset {
  id: string;
  assetTag: string;
  name: string;
  category: AssetCategory;
  serialNumber: string | null;
  status: AssetStatus;
  condition: AssetCondition;
  purchaseCost: string | number | null;
  location: string | null;
  currentAssignee: { id: string; firstNameEn: string; lastNameEn: string } | null;
}

export interface AssetAssignment {
  id: string;
  assetId: string;
  employeeId: string;
  assignedAt: string;
  dueDate: string | null;
  returnedAt: string | null;
  returnCondition: AssetCondition | null;
  note: string | null;
  asset: { id: string; assetTag: string; name: string; category: AssetCategory };
  employee: { id: string; firstNameEn: string; lastNameEn: string };
}

export interface AssetDetail extends Asset {
  assignments: AssetAssignment[];
}

export const assetsApi = {
  list: (filters?: { status?: AssetStatus; category?: AssetCategory }) => {
    const p = new URLSearchParams();
    if (filters?.status) p.set('status', filters.status);
    if (filters?.category) p.set('category', filters.category);
    const qs = p.toString();
    return authFetch(`/hr/assets${qs ? `?${qs}` : ''}`).then((r) => json<Asset[]>(r));
  },
  get: (id: string) => authFetch(`/hr/assets/${id}`).then((r) => json<AssetDetail>(r)),
  create: (data: {
    assetTag: string;
    name: string;
    category?: AssetCategory;
    serialNumber?: string;
    condition?: AssetCondition;
    purchaseCost?: number;
    location?: string;
  }) =>
    authFetch('/hr/assets', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<Asset>(r),
    ),
  update: (
    id: string,
    data: Partial<{
      assetTag: string;
      name: string;
      category: AssetCategory;
      serialNumber: string;
      condition: AssetCondition;
      status: AssetStatus;
      location: string;
    }>,
  ) =>
    authFetch(`/hr/assets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<Asset>(r),
    ),
  remove: (id: string) => del(`/hr/assets/${id}`),
  assign: (id: string, data: { employeeId: string; dueDate?: string; note?: string }) =>
    authFetch(`/hr/assets/${id}/assign`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<AssetAssignment>(r),
    ),
  return: (
    id: string,
    data: { returnCondition?: AssetCondition; status?: AssetStatus; note?: string },
  ) =>
    authFetch(`/hr/assets/${id}/return`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<AssetAssignment>(r),
    ),
  forEmployee: (employeeId: string) =>
    authFetch(`/employees/${employeeId}/assets`).then((r) => json<AssetAssignment[]>(r)),
};

// --- HR Phase 8: recruitment -------------------------------------------------
export type JobPostingStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'FILLED';
export const JOB_POSTING_STATUSES: JobPostingStatus[] = ['DRAFT', 'OPEN', 'CLOSED', 'FILLED'];
export type ApplicantStatus =
  | 'APPLIED'
  | 'SCREENING'
  | 'INTERVIEW'
  | 'OFFER'
  | 'HIRED'
  | 'REJECTED'
  | 'WITHDRAWN';
export const APPLICANT_STATUSES: ApplicantStatus[] = [
  'APPLIED',
  'SCREENING',
  'INTERVIEW',
  'OFFER',
  'HIRED',
  'REJECTED',
  'WITHDRAWN',
];
export type InterviewMode = 'ONSITE' | 'PHONE' | 'VIDEO';
export const INTERVIEW_MODES: InterviewMode[] = ['ONSITE', 'PHONE', 'VIDEO'];
export type InterviewOutcome = 'PENDING' | 'PASSED' | 'FAILED';
export const INTERVIEW_OUTCOMES: InterviewOutcome[] = ['PENDING', 'PASSED', 'FAILED'];

export interface JobPosting {
  id: string;
  title: string;
  description: string | null;
  employmentType: EmploymentType | null;
  location: string | null;
  headcount: number;
  status: JobPostingStatus;
  openedAt: string | null;
  closedAt: string | null;
  department: { id: string; name: string } | null;
  position: { id: string; title: string } | null;
  _count: { applicants: number };
}

export interface Interview {
  id: string;
  applicantId: string;
  scheduledAt: string;
  mode: InterviewMode;
  stage: string | null;
  outcome: InterviewOutcome;
  rating: number | null;
  feedback: string | null;
}

export interface JobApplicant {
  id: string;
  postingId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: ApplicantStatus;
  rating: number | null;
  notes: string | null;
  hiredEmployeeId: string | null;
  posting: { id: string; title: string };
  interviews: Interview[];
}

export const recruitmentApi = {
  listPostings: (status?: JobPostingStatus) =>
    authFetch(`/hr/job-postings${status ? `?status=${status}` : ''}`).then((r) =>
      json<JobPosting[]>(r),
    ),
  createPosting: (data: {
    title: string;
    description?: string;
    departmentId?: string;
    positionId?: string;
    employmentType?: EmploymentType;
    location?: string;
    headcount?: number;
    status?: JobPostingStatus;
  }) =>
    authFetch('/hr/job-postings', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<JobPosting>(r),
    ),
  updatePosting: (id: string, data: Partial<{ title: string; status: JobPostingStatus }>) =>
    authFetch(`/hr/job-postings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<JobPosting>(r),
    ),
  removePosting: (id: string) => del(`/hr/job-postings/${id}`),

  listApplicants: (postingId: string) =>
    authFetch(`/hr/job-postings/${postingId}/applicants`).then((r) => json<JobApplicant[]>(r)),
  createApplicant: (
    postingId: string,
    data: { firstName: string; lastName: string; email?: string; phone?: string; source?: string },
  ) =>
    authFetch(`/hr/job-postings/${postingId}/applicants`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<JobApplicant>(r)),
  updateApplicant: (
    id: string,
    data: Partial<{ status: ApplicantStatus; rating: number; notes: string }>,
  ) =>
    authFetch(`/hr/applicants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<JobApplicant>(r),
    ),
  hire: (
    id: string,
    data: {
      firstNameAr: string;
      lastNameAr: string;
      jobTitle?: string;
      departmentId?: string;
      positionId?: string;
      employmentType?: EmploymentType;
      hireDate?: string;
    },
  ) =>
    authFetch(`/hr/applicants/${id}/hire`, { method: 'POST', body: JSON.stringify(data) }).then(
      (r) => json<JobApplicant>(r),
    ),

  createInterview: (
    applicantId: string,
    data: { scheduledAt: string; mode?: InterviewMode; interviewerId?: string; stage?: string },
  ) =>
    authFetch(`/hr/applicants/${applicantId}/interviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => json<Interview>(r)),
  updateInterview: (
    id: string,
    data: Partial<{ outcome: InterviewOutcome; rating: number; feedback: string }>,
  ) =>
    authFetch(`/hr/interviews/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      json<Interview>(r),
    ),
  removeInterview: (id: string) => del(`/hr/interviews/${id}`),
};

// --- HR Phase 9: self-service (ESS) & manager portal -------------------------
export interface MyProfile {
  id: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  employeeNumber: string | null;
  jobTitle: string;
  employmentType: EmploymentType | null;
  status: EmploymentStatus;
  hireDate: string | null;
  personalEmail: string | null;
  personalPhone: string | null;
  department: { id: string; name: string } | null;
  position: { id: string; title: string } | null;
  manager: { id: string; firstNameEn: string; lastNameEn: string } | null;
}

export interface TeamMember {
  id: string;
  firstNameEn: string;
  lastNameEn: string;
  jobTitle: string;
  status: EmploymentStatus;
  department: { id: string; name: string } | null;
}

export const essApi = {
  profile: () => authFetch('/me/hr/profile').then((r) => json<MyProfile>(r)),
  leaveBalances: () => authFetch('/me/hr/leave-balances').then((r) => json<LeaveBalance[]>(r)),
  leaveRequests: () => authFetch('/me/hr/leave-requests').then((r) => json<LeaveRequest[]>(r)),
  submitLeave: (data: CreateLeaveRequestInput) =>
    authFetch('/me/hr/leave-requests', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
      json<LeaveRequest>(r),
    ),
  cancelLeave: (id: string) =>
    authFetch(`/me/hr/leave-requests/${id}/cancel`, { method: 'POST', body: '{}' }).then((r) =>
      json<LeaveRequest>(r),
    ),
  attendance: () => authFetch('/me/hr/attendance').then((r) => json<StaffAttendance[]>(r)),
  assets: () => authFetch('/me/hr/assets').then((r) => json<AssetAssignment[]>(r)),
  training: () => authFetch('/me/hr/training').then((r) => json<TrainingRecord[]>(r)),
  reviews: () => authFetch('/me/hr/reviews').then((r) => json<PerformanceReview[]>(r)),
  acknowledgeReview: (id: string) =>
    authFetch(`/me/hr/reviews/${id}/acknowledge`, { method: 'POST', body: '{}' }).then((r) =>
      json<PerformanceReview>(r),
    ),
};

export const teamApi = {
  members: () => authFetch('/me/team/members').then((r) => json<TeamMember[]>(r)),
  pendingLeave: () => authFetch('/me/team/leave-requests').then((r) => json<LeaveRequest[]>(r)),
  approve: (id: string) =>
    authFetch(`/me/team/leave-requests/${id}/approve`, { method: 'POST', body: '{}' }).then((r) =>
      json<LeaveRequest>(r),
    ),
  reject: (id: string) =>
    authFetch(`/me/team/leave-requests/${id}/reject`, { method: 'POST', body: '{}' }).then((r) =>
      json<LeaveRequest>(r),
    ),
};

// --- HR Phase 10: HR dashboard, alerts & reporting ---------------------------
export interface HrDashboard {
  generatedAt: string;
  windowDays: number;
  headcount: {
    total: number;
    byStatus: Array<{ status: EmploymentStatus; count: number }>;
    byDepartment: Array<{ departmentId: string | null; name: string; count: number }>;
  };
  leave: { pendingApprovals: number };
  recruitment: { openPostings: number; activeApplicants: number };
  assets: { total: number; assigned: number; available: number };
  performance: { activeCycles: number; reviewsAwaitingAck: number };
  expiring: {
    documents: number;
    contracts: number;
    certificates: number;
    training: number;
    probation: number;
  };
}

export type HrAlertType = 'document' | 'contract' | 'certificate' | 'training' | 'probation';
export interface HrAlert {
  type: HrAlertType;
  entityId: string;
  employeeId: string;
  employeeName: string;
  label: string;
  dueDate: string;
  daysRemaining: number;
  severity: 'overdue' | 'due_soon';
}

export const hrDashboardApi = {
  dashboard: () => authFetch('/hr/dashboard').then((r) => json<HrDashboard>(r)),
  alerts: (within = 60) =>
    authFetch(`/hr/dashboard/alerts?within=${within}`).then((r) => json<HrAlert[]>(r)),
  async exportRoster(format: 'csv' | 'xlsx' | 'pdf'): Promise<void> {
    const res = await fetch(`${API_URL}/hr/dashboard/roster/export?format=${format}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') ?? '';
    const match = /filename="([^"]+)"/.exec(disposition);
    const filename = match?.[1] ?? `hr-roster.${format}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

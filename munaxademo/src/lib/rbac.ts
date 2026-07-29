/**
 * Role-based access control — vendored from @school/domain (roles, the permission
 * catalog, and the default role→permission matrix) so the demo gates navigation,
 * dashboards and reports exactly like production, with zero monorepo coupling.
 *
 * On top of the production RBAC we define the eight DEMO PERSONAS that prospective
 * school owners switch between from the login page.
 */

/* ── Permission catalog (resource:action) ──────────────────────────────── */
export const Permission = {
  TENANT_MANAGE: 'tenant:manage',
  SCHOOL_MANAGE: 'school:manage',
  CAMPUS_MANAGE: 'campus:manage',
  ACADEMICYEAR_MANAGE: 'academicyear:manage',
  GRADE_MANAGE: 'grade:manage',
  SECTION_MANAGE: 'section:manage',
  CLASSROOM_MANAGE: 'classroom:manage',
  USER_MANAGE: 'user:manage',
  ROLE_MANAGE: 'role:manage',
  STUDENT_MANAGE: 'student:manage',
  PARENT_MANAGE: 'parent:manage',
  TEACHER_MANAGE: 'teacher:manage',
  EMPLOYEE_MANAGE: 'employee:manage',
  TIMETABLE_MANAGE: 'timetable:manage',
  TIMETABLE_READ: 'timetable:read',
  ATTENDANCE_CREATE: 'attendance:create',
  ATTENDANCE_READ: 'attendance:read',
  ATTENDANCE_EXPORT: 'attendance:export',
  PRESENCE_CREATE: 'presence:create',
  PRESENCE_READ: 'presence:read',
  TRANSPORT_CREATE: 'transport:create',
  TRANSPORT_READ: 'transport:read',
  ATTENDANCE_CONFIGURE: 'attendance:configure',
  CARD_MANAGE: 'card:manage',
  CARD_READ: 'card:read',
  HOMEWORK_MANAGE: 'homework:manage',
  HOMEWORK_READ: 'homework:read',
  BEHAVIOR_MANAGE: 'behavior:manage',
  BEHAVIOR_READ: 'behavior:read',
  GRADE_IMPORT: 'grade:import',
  GRADE_READ: 'grade:read',
  FINANCE_MANAGE: 'finance:manage',
  FINANCE_READ: 'finance:read',
  FINANCE_EXPORT: 'finance:export',
  TRANSACTION_CREATE: 'transaction:create',
  RECEIPT_UPLOAD: 'receipt:upload',
  ANNOUNCEMENT_MANAGE: 'announcement:manage',
  ANNOUNCEMENT_READ: 'announcement:read',
  NOTIFICATION_SEND: 'notification:send',
  LEAVE_REQUEST: 'leave:request',
  LEAVE_APPROVE: 'leave:approve',
  PTM_BOOK: 'ptm:book',
  PTM_MANAGE: 'ptm:manage',
  DOCUMENT_MANAGE: 'document:manage',
  RESOURCE_READ: 'resource:read',
  RESOURCE_MANAGE: 'resource:manage',
  ACHIEVEMENT_READ: 'achievement:read',
  ACHIEVEMENT_MANAGE: 'achievement:manage',
  GAMIFICATION_READ: 'gamification:read',
  BUS_MANAGE: 'bus:manage',
  BUS_ASSIGN: 'bus:assign',
  BUS_READ: 'bus:read',
  LIBRARY_MANAGE: 'library:manage',
  LIBRARY_READ: 'library:read',
  INVENTORY_MANAGE: 'inventory:manage',
  INVENTORY_READ: 'inventory:read',
  CLINIC_MANAGE: 'clinic:manage',
  CLINIC_READ: 'clinic:read',
  REPORT_READ: 'report:read',
  REPORT_EXPORT: 'report:export',
  FEATUREFLAG_MANAGE: 'featureflag:manage',
  AUDIT_READ: 'audit:read',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];
export const ALL_PERMISSIONS: Permission[] = Object.values(Permission);

const P = Permission;

/* ── Roles (subset of the Munaxa school plane used by the demo personas) ── */
export type RoleKey =
  | 'SchoolAdmin'
  | 'Principal'
  | 'Registrar'
  | 'FinanceOfficer'
  | 'Teacher'
  | 'Parent'
  | 'Student'
  | 'BusSupervisor';

/** Default role → permission mapping (mirrors docs/architecture/05-rbac-matrix.md). */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, Permission[] | '*'> = {
  SchoolAdmin: '*',
  Principal: [
    P.CARD_MANAGE,
    P.CARD_READ,
    P.PRESENCE_READ,
    P.TRANSPORT_READ,
    P.ATTENDANCE_CONFIGURE,
    P.SCHOOL_MANAGE,
    P.CAMPUS_MANAGE,
    P.ACADEMICYEAR_MANAGE,
    P.GRADE_MANAGE,
    P.SECTION_MANAGE,
    P.CLASSROOM_MANAGE,
    P.TIMETABLE_READ,
    P.ATTENDANCE_READ,
    P.HOMEWORK_READ,
    P.BEHAVIOR_MANAGE,
    P.BEHAVIOR_READ,
    P.GRADE_READ,
    P.ANNOUNCEMENT_MANAGE,
    P.NOTIFICATION_SEND,
    P.LEAVE_APPROVE,
    P.REPORT_READ,
    P.REPORT_EXPORT,
    P.AUDIT_READ,
    P.FINANCE_READ,
    P.RESOURCE_READ,
    P.RESOURCE_MANAGE,
    P.ACHIEVEMENT_MANAGE,
    P.BUS_READ,
    P.LIBRARY_READ,
    P.INVENTORY_READ,
    P.CLINIC_READ,
    P.STUDENT_MANAGE,
    P.TEACHER_MANAGE,
    P.EMPLOYEE_MANAGE,
  ],
  Registrar: [
    P.STUDENT_MANAGE,
    P.PARENT_MANAGE,
    P.DOCUMENT_MANAGE,
    P.REPORT_READ,
    P.ATTENDANCE_READ,
    P.TIMETABLE_READ,
    P.ANNOUNCEMENT_READ,
    P.GRADE_READ,
  ],
  FinanceOfficer: [
    P.FINANCE_MANAGE,
    P.FINANCE_READ,
    P.FINANCE_EXPORT,
    P.TRANSACTION_CREATE,
    P.RECEIPT_UPLOAD,
    P.REPORT_READ,
    P.REPORT_EXPORT,
    P.AUDIT_READ,
    P.STUDENT_MANAGE,
  ],
  Teacher: [
    P.CARD_READ,
    P.PRESENCE_CREATE,
    P.PRESENCE_READ,
    P.TIMETABLE_READ,
    P.ATTENDANCE_CREATE,
    P.ATTENDANCE_READ,
    P.HOMEWORK_MANAGE,
    P.HOMEWORK_READ,
    P.BEHAVIOR_MANAGE,
    P.BEHAVIOR_READ,
    P.GRADE_IMPORT,
    P.GRADE_READ,
    P.ANNOUNCEMENT_READ,
    P.NOTIFICATION_SEND,
    P.REPORT_READ,
    P.RESOURCE_READ,
    P.RESOURCE_MANAGE,
    P.ACHIEVEMENT_MANAGE,
  ],
  Parent: [
    P.PRESENCE_READ,
    P.TRANSPORT_READ,
    P.ATTENDANCE_READ,
    P.HOMEWORK_READ,
    P.BEHAVIOR_READ,
    P.GRADE_READ,
    P.TIMETABLE_READ,
    P.ANNOUNCEMENT_READ,
    P.RECEIPT_UPLOAD,
    P.FINANCE_READ,
    P.LEAVE_REQUEST,
    P.PTM_BOOK,
    P.DOCUMENT_MANAGE,
    P.RESOURCE_READ,
    P.ACHIEVEMENT_READ,
    P.GAMIFICATION_READ,
  ],
  Student: [
    P.ATTENDANCE_READ,
    P.HOMEWORK_READ,
    P.BEHAVIOR_READ,
    P.GRADE_READ,
    P.TIMETABLE_READ,
    P.ANNOUNCEMENT_READ,
    P.RESOURCE_READ,
    P.ACHIEVEMENT_READ,
    P.GAMIFICATION_READ,
  ],
  BusSupervisor: [P.TRANSPORT_CREATE, P.TRANSPORT_READ, P.CARD_READ, P.BUS_READ, P.PRESENCE_READ],
};

/** Resolve the concrete permission set for a role (expanding `'*'`). */
export function permissionsForRole(role: RoleKey): Permission[] {
  const mapped = DEFAULT_ROLE_PERMISSIONS[role];
  return mapped === '*' ? [...ALL_PERMISSIONS] : mapped;
}

/* ── Demo personas (what the login page offers) ─────────────────────────── */
export type PersonaId =
  | 'owner'
  | 'principal'
  | 'registrar'
  | 'finance'
  | 'teacher'
  | 'parent'
  | 'student'
  | 'bus';

export interface Persona {
  id: PersonaId;
  role: RoleKey;
  /** Display name used on the login card and in the shell. */
  nameEn: string;
  nameAr: string;
  /** Job title shown under the name. */
  titleEn: string;
  titleAr: string;
  /** The person this persona is signed in as, drawn from the seeded dataset. */
  displayName: string;
  /** Landing route after sign-in. */
  home: string;
  /** Short pitch shown on the persona card. */
  blurbEn: string;
  blurbAr: string;
}

export const PERSONAS: Persona[] = [
  {
    id: 'owner',
    role: 'SchoolAdmin',
    nameEn: 'School Owner',
    nameAr: 'مالك المدرسة',
    titleEn: 'Full administrative control',
    titleAr: 'تحكم إداري كامل',
    displayName: 'Rania Haddad',
    home: '/dashboard',
    blurbEn: 'See everything — admissions, finance, HR, analytics and settings.',
    blurbAr: 'رؤية كل شيء — القبول والمالية والموارد البشرية والتحليلات والإعدادات.',
  },
  {
    id: 'principal',
    role: 'Principal',
    nameEn: 'Principal',
    nameAr: 'المدير',
    titleEn: 'Academic leadership',
    titleAr: 'القيادة الأكاديمية',
    displayName: 'Dr. Samir Khoury',
    home: '/dashboard',
    blurbEn: 'School structure, academics, attendance oversight and announcements.',
    blurbAr: 'هيكل المدرسة والأكاديميات ومتابعة الحضور والإعلانات.',
  },
  {
    id: 'registrar',
    role: 'Registrar',
    nameEn: 'Registrar',
    nameAr: 'المسجل',
    titleEn: 'Admissions & records',
    titleAr: 'القبول والسجلات',
    displayName: 'Lina Aqel',
    home: '/students',
    blurbEn: 'Run admissions and manage the student & parent records.',
    blurbAr: 'إدارة القبول وسجلات الطلاب وأولياء الأمور.',
  },
  {
    id: 'finance',
    role: 'FinanceOfficer',
    nameEn: 'Finance Manager',
    nameAr: 'مدير المالية',
    titleEn: 'Billing & collections',
    titleAr: 'الفوترة والتحصيل',
    displayName: 'Omar Nseirat',
    home: '/finance',
    blurbEn: 'Invoices, payments, outstanding balances and financial reports.',
    blurbAr: 'الفواتير والمدفوعات والأرصدة المستحقة والتقارير المالية.',
  },
  {
    id: 'teacher',
    role: 'Teacher',
    nameEn: 'Teacher',
    nameAr: 'المعلم',
    titleEn: 'Classroom & grading',
    titleAr: 'الصف والتقييم',
    displayName: 'Hala Mansour',
    home: '/portal/teacher',
    blurbEn: 'Mark attendance, enter grades, set homework for your sections.',
    blurbAr: 'تسجيل الحضور وإدخال الدرجات وتعيين الواجبات لشُعبك.',
  },
  {
    id: 'parent',
    role: 'Parent',
    nameEn: 'Parent',
    nameAr: 'ولي الأمر',
    titleEn: 'Family portal',
    titleAr: 'بوابة الأسرة',
    displayName: 'Khaled Suleiman',
    home: '/portal/parent',
    blurbEn: 'Follow your children — attendance, grades, fees and messages.',
    blurbAr: 'تابع أبناءك — الحضور والدرجات والرسوم والرسائل.',
  },
  {
    id: 'student',
    role: 'Student',
    nameEn: 'Student',
    nameAr: 'الطالب',
    titleEn: 'Student portal',
    titleAr: 'بوابة الطالب',
    displayName: 'Yousef Suleiman',
    home: '/portal/student',
    blurbEn: 'Timetable, homework, grades and achievements at a glance.',
    blurbAr: 'الجدول والواجبات والدرجات والإنجازات بنظرة واحدة.',
  },
  {
    id: 'bus',
    role: 'BusSupervisor',
    nameEn: 'Bus Supervisor',
    nameAr: 'مشرف الباص',
    titleEn: 'Transport & boarding',
    titleAr: 'النقل والصعود',
    displayName: 'Faisal Odeh',
    home: '/transport',
    blurbEn: 'Routes, buses and live boarding / alighting scans.',
    blurbAr: 'المسارات والباصات ومسح الصعود والنزول المباشر.',
  },
];

export const PERSONA_BY_ID = Object.fromEntries(PERSONAS.map((p) => [p.id, p])) as Record<
  PersonaId,
  Persona
>;

export function personaPermissions(id: PersonaId): Permission[] {
  return permissionsForRole(PERSONA_BY_ID[id].role);
}

export function hasPermission(perms: readonly string[], required?: string): boolean {
  if (!required) return true;
  return perms.includes(required);
}

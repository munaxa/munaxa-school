/**
 * Permission catalog (resource:action). Extended phase-by-phase.
 * The authoritative role→permission mapping is seeded in the database (Phase 3),
 * but the catalog keys live here as the single source of truth for type-safety.
 */
export const Permission = {
  // Tenancy & structure
  TENANT_MANAGE: 'tenant:manage',
  SCHOOL_MANAGE: 'school:manage',
  CAMPUS_MANAGE: 'campus:manage',
  ACADEMICYEAR_MANAGE: 'academicyear:manage',
  GRADE_MANAGE: 'grade:manage',
  SECTION_MANAGE: 'section:manage',
  CLASSROOM_MANAGE: 'classroom:manage',

  // IAM
  USER_MANAGE: 'user:manage',
  ROLE_MANAGE: 'role:manage',

  // People
  STUDENT_MANAGE: 'student:manage',
  PARENT_MANAGE: 'parent:manage',
  TEACHER_MANAGE: 'teacher:manage',
  EMPLOYEE_MANAGE: 'employee:manage',

  // Human Resources (HR transformation). `employee:manage` remains the write capability for the
  // employee record itself; these add read separation, sensitive-data gating, lifecycle control,
  // and org-structure management so profile tabs can be authorised independently.
  EMPLOYEE_READ: 'employee:read',
  HR_SENSITIVE_READ: 'hr:sensitive:read',
  HR_LIFECYCLE_MANAGE: 'hr:lifecycle:manage',
  HR_ORG_READ: 'hr:org:read',
  HR_ORG_MANAGE: 'hr:org:manage',
  // HR Phase 2 — contracts & documents (independently authorised profile tabs).
  HR_CONTRACT_READ: 'hr:contract:read',
  HR_CONTRACT_MANAGE: 'hr:contract:manage',
  HR_DOCUMENT_READ: 'hr:document:read',
  HR_DOCUMENT_MANAGE: 'hr:document:manage',
  // HR Phase 3 — driver profiles (licence, medical, infractions). Drivers are Employees.
  DRIVER_READ: 'driver:read',
  DRIVER_MANAGE: 'driver:manage',
  // HR Phase 4 — staff leave (distinct from the student `leave:*` in the parent portal).
  STAFF_LEAVE_READ: 'staff-leave:read',
  STAFF_LEAVE_REQUEST: 'staff-leave:request',
  STAFF_LEAVE_APPROVE: 'staff-leave:approve',
  STAFF_LEAVE_MANAGE: 'staff-leave:manage',
  // HR Phase 5 — staff (payroll) attendance & payroll preparation. Distinct from the academic
  // `attendance:*` (student/teaching presence); this feeds HR payroll runs.
  STAFF_ATTENDANCE_READ: 'staff-attendance:read',
  STAFF_ATTENDANCE_MANAGE: 'staff-attendance:manage',
  PAYROLL_PREPARE: 'payroll:prepare',
  // Attendance evolution program — shift scheduling, policy configuration, immutability locks,
  // the correction workflow and biometric ingestion. All HR-scoped (staff attendance context);
  // analytics deliberately reuses HR_DASHBOARD_READ rather than adding a permission.
  SHIFT_READ: 'shift:read',
  SHIFT_MANAGE: 'shift:manage',
  ATTENDANCE_POLICY_READ: 'attendance-policy:read',
  ATTENDANCE_POLICY_MANAGE: 'attendance-policy:manage',
  ATTENDANCE_LOCK_MANAGE: 'attendance-lock:manage',
  ATTENDANCE_CORRECTION_REQUEST: 'attendance-correction:request',
  ATTENDANCE_CORRECTION_APPROVE: 'attendance-correction:approve',
  BIOMETRIC_INGEST: 'biometric:ingest',
  // HR Phase 6 — performance management & training.
  PERFORMANCE_READ: 'performance:read',
  PERFORMANCE_MANAGE: 'performance:manage',
  TRAINING_READ: 'training:read',
  TRAINING_MANAGE: 'training:manage',
  // HR Phase 7 — asset management (custody-tracked staff assets).
  ASSET_READ: 'asset:read',
  ASSET_MANAGE: 'asset:manage',
  // HR Phase 8 — recruitment (vacancies, applicants, interviews, hire).
  RECRUITMENT_READ: 'recruitment:read',
  RECRUITMENT_MANAGE: 'recruitment:manage',
  // HR Phase 9 — employee self-service (own HR data) & manager portal (direct reports).
  ESS_READ: 'ess:read',
  ESS_REQUEST: 'ess:request',
  TEAM_READ: 'team:read',
  TEAM_APPROVE: 'team:approve',
  // HR Phase 10 — HR analytics dashboard, alerts & reporting.
  HR_DASHBOARD_READ: 'hr:dashboard:read',

  // Operations
  TIMETABLE_MANAGE: 'timetable:manage',
  TIMETABLE_READ: 'timetable:read',
  ATTENDANCE_CREATE: 'attendance:create',
  ATTENDANCE_READ: 'attendance:read',
  ATTENDANCE_EXPORT: 'attendance:export',
  // Campus presence + transportation (Phase 21)
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

  // Finance
  FINANCE_MANAGE: 'finance:manage',
  FINANCE_READ: 'finance:read',
  FINANCE_EXPORT: 'finance:export',
  // Changing the LEGAL payer of a student's Financial Account — stronger than ordinary finance editing.
  FINANCE_TRANSFER_BILLING: 'finance:transfer-billing',
  TRANSACTION_CREATE: 'transaction:create',
  RECEIPT_UPLOAD: 'receipt:upload',
  // Admissions / enrollment (Phase 22)
  ENROLLMENT_MANAGE: 'enrollment:manage',
  FEE_OVERRIDE: 'fee:override',
  FINANCE_APPROVE: 'finance:approve',

  // Communication
  ANNOUNCEMENT_MANAGE: 'announcement:manage',
  ANNOUNCEMENT_READ: 'announcement:read',
  NOTIFICATION_SEND: 'notification:send',
  NOTIFICATION_SETTINGS: 'notification:settings',

  // Parent/student flows
  LEAVE_REQUEST: 'leave:request',
  LEAVE_APPROVE: 'leave:approve',
  PTM_BOOK: 'ptm:book',
  PTM_MANAGE: 'ptm:manage',
  DOCUMENT_MANAGE: 'document:manage',
  // Enterprise Document Engine (Phase 23): official document generation & archive.
  DOCUMENT_READ: 'document:read',
  DOCUMENT_GENERATE: 'document:generate',
  // Signed registration-agreement handling (upload the parent's countersigned copy; replace/delete).
  DOCUMENT_UPLOAD_SIGNED: 'document:upload_signed',
  DOCUMENT_REPLACE_SIGNED: 'document:replace_signed',
  DOCUMENT_DELETE_SIGNED: 'document:delete_signed',

  // Student app (resources & gamification)
  RESOURCE_READ: 'resource:read',
  RESOURCE_MANAGE: 'resource:manage',
  ACHIEVEMENT_READ: 'achievement:read',
  ACHIEVEMENT_MANAGE: 'achievement:manage',
  GAMIFICATION_READ: 'gamification:read',

  // Advanced modules (feature-flagged, disabled by default)
  BUS_MANAGE: 'bus:manage',
  // Assign students to routes/stops without being able to reconfigure routes or buses.
  BUS_ASSIGN: 'bus:assign',
  BUS_READ: 'bus:read',
  LIBRARY_MANAGE: 'library:manage',
  LIBRARY_READ: 'library:read',
  INVENTORY_MANAGE: 'inventory:manage',
  INVENTORY_READ: 'inventory:read',
  CLINIC_MANAGE: 'clinic:manage',
  CLINIC_READ: 'clinic:read',

  // Organization identity & branding (Settings → Organization)
  ORGANIZATION_READ: 'organization:read',
  ORGANIZATION_UPDATE: 'organization:update',
  ORGANIZATION_BRANDING: 'organization:branding',
  ORGANIZATION_DOCUMENTS: 'organization:documents',
  ORGANIZATION_COMMUNICATION: 'organization:communication',
  ORGANIZATION_COMPLIANCE: 'organization:compliance',
  ORGANIZATION_ADVANCED: 'organization:advanced',

  // Reporting & config
  REPORT_READ: 'report:read',
  REPORT_EXPORT: 'report:export',
  FEATUREFLAG_MANAGE: 'featureflag:manage',
  AUDIT_READ: 'audit:read',

  // Subscription (school-plane: a school admin views its own subscription and requests upgrades;
  // schools can NEVER change their own plan — only request a change the platform reviews).
  SUBSCRIPTION_READ: 'subscription:read',
  SUBSCRIPTION_UPGRADE_REQUEST: 'subscription:upgrade-request',

  // Platform
  PLATFORM_TENANT_MANAGE: 'platform:tenant:manage',
  SUPPORT_IMPERSONATE: 'support:impersonate',

  // Platform Console (super-admin plane — Munaxa employees only; outside tenant RBAC).
  PLATFORM_DASHBOARD_READ: 'platform:dashboard:read',
  PLATFORM_SCHOOL_READ: 'platform:school:read',
  PLATFORM_SUBSCRIPTION_READ: 'platform:subscription:read',
  PLATFORM_SUBSCRIPTION_MANAGE: 'platform:subscription:manage',
  PLATFORM_PLAN_MANAGE: 'platform:plan:manage',
  PLATFORM_UPGRADE_REVIEW: 'platform:upgrade:review',
  PLATFORM_TRIAL_MANAGE: 'platform:trial:manage',
  PLATFORM_BILLING_READ: 'platform:billing:read',
  PLATFORM_BILLING_MANAGE: 'platform:billing:manage',
  PLATFORM_COUPON_MANAGE: 'platform:coupon:manage',
  PLATFORM_FEATURE_OVERRIDE: 'platform:feature:override',
  PLATFORM_FEATUREFLAG_MANAGE: 'platform:featureflag:manage',
  PLATFORM_SUPPORT_MANAGE: 'platform:support:manage',
  PLATFORM_AUDIT_READ: 'platform:audit:read',
  PLATFORM_USER_MANAGE: 'platform:user:manage',
  PLATFORM_SYSTEM_HEALTH_READ: 'platform:system:read',
  PLATFORM_REVENUE_READ: 'platform:revenue:read',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export const ALL_PERMISSIONS: Permission[] = Object.values(Permission);

/** Human-readable, plain-language explanation of what each permission grants. Shown in the
 * roles & permissions editor (as a hover tooltip) so admins know what they're enabling. */
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  [Permission.TENANT_MANAGE]: 'Manage tenant-wide settings for the school organization.',
  [Permission.SCHOOL_MANAGE]: 'Create and edit school records.',
  [Permission.CAMPUS_MANAGE]: 'Create and edit campuses.',
  [Permission.ACADEMICYEAR_MANAGE]: 'Create and edit academic years and terms.',
  [Permission.GRADE_MANAGE]: 'Create and edit grade levels.',
  [Permission.SECTION_MANAGE]: 'Create and edit class sections.',
  [Permission.CLASSROOM_MANAGE]: 'Create and edit classrooms.',

  [Permission.USER_MANAGE]: 'Create, edit, and deactivate user accounts.',
  [Permission.ROLE_MANAGE]: 'Create, edit, and delete roles and assign permissions.',

  [Permission.STUDENT_MANAGE]: 'Create and edit student profiles and enrollment records.',
  [Permission.PARENT_MANAGE]: 'Create and edit parent/guardian profiles.',
  [Permission.TEACHER_MANAGE]: 'Create and edit teacher profiles.',
  [Permission.EMPLOYEE_MANAGE]: 'Create and edit staff/employee profiles.',
  [Permission.EMPLOYEE_READ]: 'View the staff directory and non-sensitive employee profiles.',
  [Permission.HR_SENSITIVE_READ]:
    'View sensitive employee data (national ID, passport, visa, date of birth, bank details).',
  [Permission.HR_LIFECYCLE_MANAGE]:
    'Change an employee’s employment status (hire, probation, leave, suspend, terminate, archive).',
  [Permission.HR_ORG_READ]: 'View the organisation structure (departments, positions, org chart).',
  [Permission.HR_ORG_MANAGE]: 'Create and edit departments and positions.',
  [Permission.HR_CONTRACT_READ]: 'View employment contracts and their terms.',
  [Permission.HR_CONTRACT_MANAGE]: 'Create, edit, renew and terminate employment contracts.',
  [Permission.HR_DOCUMENT_READ]: 'View and download employee documents.',
  [Permission.HR_DOCUMENT_MANAGE]: 'Upload, version and delete employee documents.',
  [Permission.DRIVER_READ]: 'View driver profiles (licence, medical, infractions, assigned buses).',
  [Permission.DRIVER_MANAGE]: 'Create and edit driver profiles and record infractions.',
  [Permission.STAFF_LEAVE_READ]: 'View staff leave types, balances and requests.',
  [Permission.STAFF_LEAVE_REQUEST]: 'Submit staff leave requests.',
  [Permission.STAFF_LEAVE_APPROVE]: 'Approve or reject staff leave requests.',
  [Permission.STAFF_LEAVE_MANAGE]: 'Manage staff leave types and balances.',
  [Permission.STAFF_ATTENDANCE_READ]: 'View staff daily attendance records for payroll.',
  [Permission.STAFF_ATTENDANCE_MANAGE]:
    'Record, bulk-mark and correct staff daily attendance (check-in/out, overtime).',
  [Permission.PAYROLL_PREPARE]:
    'Generate payroll-preparation summaries from staff attendance and approved leave.',
  [Permission.SHIFT_READ]: 'View work shifts and employee shift assignments.',
  [Permission.SHIFT_MANAGE]: 'Create and assign work shifts (windows, breaks, hour caps).',
  [Permission.ATTENDANCE_POLICY_READ]: 'View attendance policy thresholds.',
  [Permission.ATTENDANCE_POLICY_MANAGE]:
    'Configure attendance policy thresholds (grace, late, absent, overtime).',
  [Permission.ATTENDANCE_LOCK_MANAGE]:
    'Lock and release staff attendance periods for payroll integrity.',
  [Permission.ATTENDANCE_CORRECTION_REQUEST]: 'Request a correction to a staff attendance day.',
  [Permission.ATTENDANCE_CORRECTION_APPROVE]:
    'Approve or reject staff attendance correction requests.',
  [Permission.BIOMETRIC_INGEST]: 'Ingest attendance punches from biometric/device providers.',
  [Permission.PERFORMANCE_READ]: 'View performance cycles, appraisals and goals.',
  [Permission.PERFORMANCE_MANAGE]:
    'Manage performance cycles, write appraisals, and set employee goals.',
  [Permission.TRAINING_READ]: 'View the training catalog and employee training records.',
  [Permission.TRAINING_MANAGE]: 'Manage training courses and employee enrolments/completions.',
  [Permission.ASSET_READ]: 'View the asset register and staff asset assignments.',
  [Permission.ASSET_MANAGE]: 'Manage assets and assign/return them to staff (custody tracking).',
  [Permission.RECRUITMENT_READ]: 'View job postings, applicants and interviews.',
  [Permission.RECRUITMENT_MANAGE]:
    'Manage job postings, applicants and interviews, and hire an applicant into an employee.',
  [Permission.ESS_READ]: 'View your own HR data (profile, leave, attendance, assets, training).',
  [Permission.ESS_REQUEST]: 'Submit and cancel your own leave requests.',
  [Permission.TEAM_READ]: 'View your direct reports and their pending requests.',
  [Permission.TEAM_APPROVE]: 'Approve or reject leave requests from your direct reports.',
  [Permission.HR_DASHBOARD_READ]: 'View the HR analytics dashboard, alerts and headcount reports.',

  [Permission.TIMETABLE_MANAGE]: 'Create and edit class timetables.',
  [Permission.TIMETABLE_READ]: 'View class timetables.',
  [Permission.ATTENDANCE_CREATE]: 'Record student or staff attendance.',
  [Permission.ATTENDANCE_READ]: 'View attendance records and history.',
  [Permission.ATTENDANCE_EXPORT]: 'Export attendance data.',
  [Permission.PRESENCE_CREATE]: 'Record campus presence (check-in/check-out) events.',
  [Permission.PRESENCE_READ]: 'View campus presence records.',
  [Permission.TRANSPORT_CREATE]: 'Record transportation/bus trip events.',
  [Permission.TRANSPORT_READ]: 'View transportation routes and trip records.',
  [Permission.ATTENDANCE_CONFIGURE]: 'Configure attendance rules and policies.',
  [Permission.CARD_MANAGE]: 'Issue and manage student/staff ID cards.',
  [Permission.CARD_READ]: 'View ID card assignments.',
  [Permission.HOMEWORK_MANAGE]: 'Create and edit homework assignments.',
  [Permission.HOMEWORK_READ]: 'View homework assignments.',
  [Permission.BEHAVIOR_MANAGE]: 'Record and edit behavior incidents and notes.',
  [Permission.BEHAVIOR_READ]: 'View behavior incidents and notes.',
  [Permission.GRADE_IMPORT]: 'Bulk-import grades from spreadsheets or other systems.',
  [Permission.GRADE_READ]: 'View student grades.',

  [Permission.FINANCE_MANAGE]: 'Manage fee plans, invoices, and financial configuration.',
  [Permission.FINANCE_READ]: 'View invoices, payments, and outstanding balances.',
  [Permission.FINANCE_EXPORT]: 'Export financial reports and statements.',
  [Permission.FINANCE_TRANSFER_BILLING]:
    "Change the legal payer of a student's Financial Account (billing responsibility transfer).",
  [Permission.TRANSACTION_CREATE]: 'Record payments and other financial transactions.',
  [Permission.RECEIPT_UPLOAD]: 'Upload payment receipts.',
  [Permission.ENROLLMENT_MANAGE]: 'Manage admissions and enrollment applications.',
  [Permission.FEE_OVERRIDE]: 'Override or discount fees on an individual basis.',
  [Permission.FINANCE_APPROVE]: 'Approve financial transactions and adjustments.',

  [Permission.ANNOUNCEMENT_MANAGE]: 'Create, edit, and publish school-wide announcements.',
  [Permission.ANNOUNCEMENT_READ]: 'View announcements.',
  [Permission.NOTIFICATION_SEND]: 'Send notifications to parents, students, or staff.',
  [Permission.NOTIFICATION_SETTINGS]: 'Configure notification preferences and channels.',

  [Permission.LEAVE_REQUEST]: 'Submit leave requests.',
  [Permission.LEAVE_APPROVE]: 'Approve or reject leave requests.',
  [Permission.PTM_BOOK]: 'Book parent-teacher meeting slots.',
  [Permission.PTM_MANAGE]: 'Create and manage parent-teacher meeting schedules.',
  [Permission.DOCUMENT_MANAGE]: 'Upload and manage shared documents.',
  [Permission.DOCUMENT_READ]:
    'View, download and reprint archived official documents (agreements, receipts, certificates, statements).',
  [Permission.DOCUMENT_GENERATE]:
    'Generate official documents (registration agreements, tuition/clearance/balance certificates, statements) and email them.',
  [Permission.DOCUMENT_UPLOAD_SIGNED]:
    "Upload the parent's countersigned registration agreement as the school's legal copy.",
  [Permission.DOCUMENT_REPLACE_SIGNED]:
    'Replace a previously uploaded signed registration agreement (fully audited).',
  [Permission.DOCUMENT_DELETE_SIGNED]:
    'Delete an uploaded signed registration agreement (fully audited).',

  [Permission.RESOURCE_READ]: 'View shared learning resources.',
  [Permission.RESOURCE_MANAGE]: 'Upload and manage shared learning resources.',
  [Permission.ACHIEVEMENT_READ]: 'View student achievements and badges.',
  [Permission.ACHIEVEMENT_MANAGE]: 'Create and award achievements and badges.',
  [Permission.GAMIFICATION_READ]: 'View gamification points and leaderboards.',

  [Permission.BUS_MANAGE]: 'Create and edit bus routes and vehicles.',
  [Permission.BUS_ASSIGN]: 'Assign students to bus routes and stops.',
  [Permission.BUS_READ]: 'View bus routes and assignments.',
  [Permission.LIBRARY_MANAGE]: 'Manage the library catalog and loans.',
  [Permission.LIBRARY_READ]: 'View the library catalog and loan records.',
  [Permission.INVENTORY_MANAGE]: 'Manage inventory items and stock levels.',
  [Permission.INVENTORY_READ]: 'View inventory items and stock levels.',
  [Permission.CLINIC_MANAGE]: 'Record and manage clinic visits and health records.',
  [Permission.CLINIC_READ]: 'View clinic visits and health records.',

  [Permission.ORGANIZATION_READ]:
    'View the school organization profile, branding, and document settings.',
  [Permission.ORGANIZATION_UPDATE]:
    'Edit the school identity, contact, and general organization settings.',
  [Permission.ORGANIZATION_BRANDING]:
    'Manage branding assets (logos, stamp, signature, watermark) and their toggles.',
  [Permission.ORGANIZATION_DOCUMENTS]:
    'Configure printed document layout (header, footer, margins, QR, paper size).',
  [Permission.ORGANIZATION_COMMUNICATION]:
    'Configure organization communication identity (sender, footer, display names).',
  [Permission.ORGANIZATION_COMPLIANCE]:
    'Manage legal and compliance identifiers (registration, license, tax/VAT).',
  [Permission.ORGANIZATION_ADVANCED]:
    'Configure advanced document defaults (language, fonts, quality, optimization).',

  [Permission.REPORT_READ]: 'View reports and dashboards.',
  [Permission.REPORT_EXPORT]: 'Export reports.',
  [Permission.FEATUREFLAG_MANAGE]: 'Enable or disable feature flags for the tenant.',
  [Permission.AUDIT_READ]: 'View the audit log of actions taken in the system.',

  [Permission.SUBSCRIPTION_READ]:
    "View this school's current subscription plan, usage, limits, and renewal.",
  [Permission.SUBSCRIPTION_UPGRADE_REQUEST]:
    'Request a subscription plan change (reviewed and applied by Munaxa — schools cannot self-serve plan changes).',

  [Permission.PLATFORM_TENANT_MANAGE]: 'Manage tenant accounts at the platform level.',
  [Permission.SUPPORT_IMPERSONATE]: 'Temporarily sign in as another user for support purposes.',

  [Permission.PLATFORM_DASHBOARD_READ]: 'View the Platform Console operational dashboard.',
  [Permission.PLATFORM_SCHOOL_READ]: 'View all customer schools (tenants) in the Platform Console.',
  [Permission.PLATFORM_SUBSCRIPTION_READ]: 'View every school subscription across the platform.',
  [Permission.PLATFORM_SUBSCRIPTION_MANAGE]:
    'Create, change, suspend, or cancel school subscriptions.',
  [Permission.PLATFORM_PLAN_MANAGE]: 'Create and edit subscription plans and their entitlements.',
  [Permission.PLATFORM_UPGRADE_REVIEW]: 'Review, approve, or reject school upgrade requests.',
  [Permission.PLATFORM_TRIAL_MANAGE]: 'Start, extend, convert, or end school trials.',
  [Permission.PLATFORM_BILLING_READ]: 'View billing profiles and invoices across the platform.',
  [Permission.PLATFORM_BILLING_MANAGE]:
    'Manage billing profiles, payment methods, and manual activations.',
  [Permission.PLATFORM_COUPON_MANAGE]: 'Create and manage discount coupons.',
  [Permission.PLATFORM_FEATURE_OVERRIDE]:
    'Override individual features or limits for a single tenant without changing its plan.',
  [Permission.PLATFORM_FEATUREFLAG_MANAGE]: 'Manage platform-wide and per-tenant feature flags.',
  [Permission.PLATFORM_SUPPORT_MANAGE]: 'Access and manage platform support operations.',
  [Permission.PLATFORM_AUDIT_READ]: 'Read the cross-tenant platform audit log.',
  [Permission.PLATFORM_USER_MANAGE]: 'Manage Platform Console (Munaxa employee) user accounts.',
  [Permission.PLATFORM_SYSTEM_HEALTH_READ]: 'View platform system health and operational metrics.',
  [Permission.PLATFORM_REVENUE_READ]: 'View platform revenue and MRR/ARR reporting.',
};

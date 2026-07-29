import type { NotificationCategory, NotificationPriority } from '@prisma/client';

/**
 * The catalogue of domain events that produce notifications. Every Munaxa module emits one of
 * these via {@link NotificationEventBus}; no module talks to FCM/Resend directly.
 */
export const NotificationEventType = {
  // Attendance
  AttendanceMarked: 'AttendanceMarked',
  StudentAbsent: 'StudentAbsent',
  StudentLate: 'StudentLate',
  // Staff attendance (HR) — Attendance evolution program. Distinct from the student events above:
  // these target employees/managers/HR, never parents.
  StaffLate: 'StaffLate',
  StaffAbsent: 'StaffAbsent',
  StaffMissedCheckIn: 'StaffMissedCheckIn',
  StaffMissedCheckOut: 'StaffMissedCheckOut',
  OvertimeApproved: 'OvertimeApproved',
  AttendanceCorrectionRequested: 'AttendanceCorrectionRequested',
  AttendanceCorrectionApproved: 'AttendanceCorrectionApproved',
  AttendanceCorrectionRejected: 'AttendanceCorrectionRejected',
  UnauthorizedAttendanceCorrection: 'UnauthorizedAttendanceCorrection',
  AttendanceLocked: 'AttendanceLocked',
  AttendanceUnlocked: 'AttendanceUnlocked',
  TeacherUnavailable: 'TeacherUnavailable',
  DriverUnavailable: 'DriverUnavailable',
  // Academics
  HomeworkAssigned: 'HomeworkAssigned',
  HomeworkDue: 'HomeworkDue',
  GradePublished: 'GradePublished',
  ReportPublished: 'ReportPublished',
  DocumentUploaded: 'DocumentUploaded',
  // Behavior
  BehaviorRecorded: 'BehaviorRecorded',
  // Communication
  AnnouncementCreated: 'AnnouncementCreated',
  // Finance
  PaymentDue: 'PaymentDue',
  PaymentOverdue: 'PaymentOverdue',
  PaymentReceived: 'PaymentReceived',
  RefundApproved: 'RefundApproved',
  // Parent flows
  LeaveApproved: 'LeaveApproved',
  LeaveRejected: 'LeaveRejected',
  PTMBooked: 'PTMBooked',
  // System / security
  UserCreated: 'UserCreated',
  PasswordResetRequested: 'PasswordResetRequested',
  LoginOTPRequested: 'LoginOTPRequested',
  EmergencyAlert: 'EmergencyAlert',
  SchoolClosure: 'SchoolClosure',
  SecurityIncident: 'SecurityIncident',
} as const;

export type NotificationEventType =
  (typeof NotificationEventType)[keyof typeof NotificationEventType];

/** Default (category, priority) for each event. Producers may override priority per-emit. */
export const EVENT_DEFAULTS: Record<
  string,
  { category: NotificationCategory; priority: NotificationPriority }
> = {
  AttendanceMarked: { category: 'ATTENDANCE', priority: 'NORMAL' },
  StudentAbsent: { category: 'ATTENDANCE', priority: 'HIGH' },
  StudentLate: { category: 'ATTENDANCE', priority: 'NORMAL' },
  StaffLate: { category: 'ATTENDANCE', priority: 'NORMAL' },
  StaffAbsent: { category: 'ATTENDANCE', priority: 'HIGH' },
  StaffMissedCheckIn: { category: 'ATTENDANCE', priority: 'HIGH' },
  StaffMissedCheckOut: { category: 'ATTENDANCE', priority: 'NORMAL' },
  OvertimeApproved: { category: 'ATTENDANCE', priority: 'NORMAL' },
  AttendanceCorrectionRequested: { category: 'ATTENDANCE', priority: 'NORMAL' },
  AttendanceCorrectionApproved: { category: 'ATTENDANCE', priority: 'NORMAL' },
  AttendanceCorrectionRejected: { category: 'ATTENDANCE', priority: 'NORMAL' },
  UnauthorizedAttendanceCorrection: { category: 'ATTENDANCE', priority: 'CRITICAL' },
  AttendanceLocked: { category: 'ATTENDANCE', priority: 'HIGH' },
  AttendanceUnlocked: { category: 'ATTENDANCE', priority: 'HIGH' },
  TeacherUnavailable: { category: 'ATTENDANCE', priority: 'HIGH' },
  DriverUnavailable: { category: 'ATTENDANCE', priority: 'CRITICAL' },
  HomeworkAssigned: { category: 'ACADEMIC', priority: 'NORMAL' },
  HomeworkDue: { category: 'ACADEMIC', priority: 'NORMAL' },
  GradePublished: { category: 'ACADEMIC', priority: 'NORMAL' },
  ReportPublished: { category: 'ACADEMIC', priority: 'NORMAL' },
  DocumentUploaded: { category: 'ACADEMIC', priority: 'NORMAL' },
  BehaviorRecorded: { category: 'BEHAVIOR', priority: 'NORMAL' },
  AnnouncementCreated: { category: 'ANNOUNCEMENT', priority: 'NORMAL' },
  PaymentDue: { category: 'FINANCE', priority: 'NORMAL' },
  PaymentOverdue: { category: 'FINANCE', priority: 'HIGH' },
  PaymentReceived: { category: 'FINANCE', priority: 'NORMAL' },
  RefundApproved: { category: 'FINANCE', priority: 'NORMAL' },
  LeaveApproved: { category: 'ACADEMIC', priority: 'NORMAL' },
  LeaveRejected: { category: 'ACADEMIC', priority: 'NORMAL' },
  PTMBooked: { category: 'ACADEMIC', priority: 'HIGH' },
  UserCreated: { category: 'SYSTEM', priority: 'NORMAL' },
  PasswordResetRequested: { category: 'SYSTEM', priority: 'CRITICAL' },
  LoginOTPRequested: { category: 'SYSTEM', priority: 'CRITICAL' },
  EmergencyAlert: { category: 'SYSTEM', priority: 'CRITICAL' },
  SchoolClosure: { category: 'SYSTEM', priority: 'CRITICAL' },
  SecurityIncident: { category: 'SYSTEM', priority: 'CRITICAL' },
};

/** How recipients are targeted. Either explicit users or an audience query resolved in-tenant. */
export type RecipientSpec =
  | { userIds: string[] }
  | {
      audience: 'ALL' | 'PARENTS' | 'TEACHERS' | 'STUDENTS' | 'SECTION';
      sectionId?: string | null;
    };

/** A typed, tenant-scoped notification event handed to the engine. */
export interface NotificationEvent {
  /** Use a {@link NotificationEventType} value; free strings are accepted for custom events. */
  type: string;
  /** Override the default category for the event type. */
  category?: NotificationCategory;
  /** Override the default priority for the event type. */
  priority?: NotificationPriority;
  recipients: RecipientSpec;
  /** Template variables ({{StudentName}}, {{Amount}}, ...). */
  context?: Record<string, string | number>;
  /** Pre-rendered fallbacks if no template exists. */
  title?: string;
  body?: string;
  /** School-enforced — bypasses user preferences (still honours tenant kill-switches). */
  mandatory?: boolean;
  /** Dedupe key; defaults to `${type}:${entityId}` when omitted by the producer. */
  idempotencyKey?: string;
  /** Link back to an announcement, when applicable. */
  announcementId?: string;
  /** Arbitrary structured payload stored on the notification (deep-link ids, etc.). */
  data?: Record<string, unknown>;
}

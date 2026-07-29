import type { DomainEvent } from '../../events/domain-events';

/**
 * Pure builder for the `StaffAttendanceRecorded` integration event (Attendance evolution program).
 *
 * Kept side-effect-free and dependency-light so it is unit-testable and so the same shape can be
 * serialized to a durable outbox later. HR staff-attendance is the *only* producer of this event
 * (canonical owner); Academics/Transport/Notifications consume it — see CAPABILITY_OWNERSHIP_MATRIX.
 */
export type StaffAttendanceRecordedEvent = Extract<
  DomainEvent,
  { type: 'StaffAttendanceRecorded' }
>;

export interface StaffAttendanceRecordedInput {
  tenantId: string;
  employeeId: string;
  /** The attendance day — a Date or an ISO string; normalised to YYYY-MM-DD. */
  date: Date | string;
  /** StaffAttendanceStatus (serialized). */
  status: string;
  /** StaffAttendanceSource (serialized). */
  source: string;
  /** Overwritten status when this write corrected an existing day; null on create/unchanged. */
  previousStatus?: string | null;
}

/** Build a `StaffAttendanceRecorded` domain event from a persisted attendance write. */
export function staffAttendanceRecordedEvent(
  input: StaffAttendanceRecordedInput,
): StaffAttendanceRecordedEvent {
  return {
    type: 'StaffAttendanceRecorded',
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    date: toIsoDay(input.date),
    status: input.status,
    source: input.source,
    previousStatus: input.previousStatus ?? null,
  };
}

/** Whether an event represents a correction (an existing day whose status changed). */
export function isCorrection(event: StaffAttendanceRecordedEvent): boolean {
  return event.previousStatus !== null && event.previousStatus !== event.status;
}

function toIsoDay(date: Date | string): string {
  return (typeof date === 'string' ? date : date.toISOString()).slice(0, 10);
}

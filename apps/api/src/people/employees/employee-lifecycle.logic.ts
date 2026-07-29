import { EmploymentStatus } from '@prisma/client';

/**
 * Employee lifecycle state machine (HR transformation, Phase 1).
 *
 * The 16 EmploymentStatus values form a directed graph. `create` seeds an employee at any
 * "entry" status; thereafter status only changes through {@link canTransition}-approved edges,
 * each recorded in EmployeeStatusHistory + AuditLog. Keeping the rules here (pure, dependency-free)
 * makes them unit-testable and reusable by the recruitment module (Phase 8) when it converts an
 * applicant into a hired employee.
 */

/** Statuses an employee record may be *created* at directly (recruitment pipeline + direct hire). */
export const ENTRY_STATUSES: readonly EmploymentStatus[] = [
  EmploymentStatus.CANDIDATE,
  EmploymentStatus.HIRED,
  EmploymentStatus.PROBATION,
  EmploymentStatus.ACTIVE,
];

/** Exit statuses: the employment has ended. From here the only move is to ARCHIVED. */
export const EXIT_STATUSES: readonly EmploymentStatus[] = [
  EmploymentStatus.RETIRED,
  EmploymentStatus.RESIGNED,
  EmploymentStatus.TERMINATED,
];

/** Statuses that stamp `terminationDate` when entered. */
export const TERMINAL_EMPLOYMENT_STATUSES: readonly EmploymentStatus[] = EXIT_STATUSES;

/** ARCHIVED is fully terminal (record retained for history only). */
export function isArchived(status: EmploymentStatus): boolean {
  return status === EmploymentStatus.ARCHIVED;
}

/**
 * Allowed forward transitions. Absent keys (e.g. ARCHIVED) have no outgoing edges.
 * "Working" statuses (ACTIVE, TRANSFERRED, PROMOTION, ON_LEAVE, SUSPENDED) can reach the exit
 * statuses; the recruitment prefix (CANDIDATE…) funnels toward HIRED.
 */
const TRANSITIONS: Partial<Record<EmploymentStatus, readonly EmploymentStatus[]>> = {
  [EmploymentStatus.CANDIDATE]: [EmploymentStatus.INTERVIEW, EmploymentStatus.ARCHIVED],
  [EmploymentStatus.INTERVIEW]: [EmploymentStatus.OFFER_SENT, EmploymentStatus.ARCHIVED],
  [EmploymentStatus.OFFER_SENT]: [
    EmploymentStatus.OFFER_ACCEPTED,
    EmploymentStatus.BACKGROUND_CHECK,
    EmploymentStatus.ARCHIVED,
  ],
  [EmploymentStatus.OFFER_ACCEPTED]: [
    EmploymentStatus.BACKGROUND_CHECK,
    EmploymentStatus.HIRED,
    EmploymentStatus.ARCHIVED,
  ],
  [EmploymentStatus.BACKGROUND_CHECK]: [EmploymentStatus.HIRED, EmploymentStatus.ARCHIVED],
  [EmploymentStatus.HIRED]: [EmploymentStatus.PROBATION, EmploymentStatus.ACTIVE],
  [EmploymentStatus.PROBATION]: [
    EmploymentStatus.ACTIVE,
    EmploymentStatus.TERMINATED,
    EmploymentStatus.RESIGNED,
  ],
  [EmploymentStatus.ACTIVE]: [
    EmploymentStatus.ON_LEAVE,
    EmploymentStatus.SUSPENDED,
    EmploymentStatus.TRANSFERRED,
    EmploymentStatus.PROMOTION,
    EmploymentStatus.RESIGNED,
    EmploymentStatus.RETIRED,
    EmploymentStatus.TERMINATED,
  ],
  [EmploymentStatus.TRANSFERRED]: [
    EmploymentStatus.ACTIVE,
    EmploymentStatus.ON_LEAVE,
    EmploymentStatus.RESIGNED,
    EmploymentStatus.TERMINATED,
  ],
  [EmploymentStatus.PROMOTION]: [
    EmploymentStatus.ACTIVE,
    EmploymentStatus.ON_LEAVE,
    EmploymentStatus.RESIGNED,
    EmploymentStatus.TERMINATED,
  ],
  [EmploymentStatus.ON_LEAVE]: [
    EmploymentStatus.ACTIVE,
    EmploymentStatus.SUSPENDED,
    EmploymentStatus.RESIGNED,
    EmploymentStatus.RETIRED,
    EmploymentStatus.TERMINATED,
  ],
  [EmploymentStatus.SUSPENDED]: [
    EmploymentStatus.ACTIVE,
    EmploymentStatus.TERMINATED,
    EmploymentStatus.RESIGNED,
  ],
  [EmploymentStatus.RETIRED]: [EmploymentStatus.ARCHIVED],
  [EmploymentStatus.RESIGNED]: [EmploymentStatus.ARCHIVED],
  [EmploymentStatus.TERMINATED]: [EmploymentStatus.ARCHIVED],
  // ARCHIVED: terminal — no outgoing transitions.
};

/** The set of statuses reachable from `from` in one step. */
export function allowedNextStatuses(from: EmploymentStatus): readonly EmploymentStatus[] {
  return TRANSITIONS[from] ?? [];
}

/** Whether moving `from → to` is a permitted single-step transition. */
export function canTransition(from: EmploymentStatus, to: EmploymentStatus): boolean {
  if (from === to) return false;
  return allowedNextStatuses(from).includes(to);
}

/** Whether entering `status` should stamp the employee's `terminationDate`. */
export function stampsTerminationDate(status: EmploymentStatus): boolean {
  return TERMINAL_EMPLOYMENT_STATUSES.includes(status);
}

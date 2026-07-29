/**
 * Driver duty resolution (Attendance evolution program, PR-7).
 *
 * Pure mapping from an HR staff-attendance status to a transport-facing duty status, plus which
 * routes are affected. Transport stays fully independent: it learns about driver availability from
 * a domain event and this pure mapping — it never imports HR services (Rule: events replace tight
 * coupling).
 */
import type { StaffAttendanceStatus } from '@prisma/client';

/** What Transport needs to know about a driver for a given day. */
export type DriverDutyStatus = 'ON_DUTY' | 'LATE' | 'UNAVAILABLE';

/** Route legs a driver absence can affect. */
export type RouteLeg = 'MORNING' | 'AFTERNOON';

export interface DriverDutySignal {
  status: DriverDutyStatus;
  /** True when Transport must arrange a replacement driver. */
  needsReplacement: boolean;
  /** Legs impacted — both when fully unavailable, morning-only when merely late. */
  affectedLegs: RouteLeg[];
  reason: string;
}

const BOTH_LEGS: RouteLeg[] = ['MORNING', 'AFTERNOON'];

/**
 * Map a staff attendance status to a driver duty signal.
 *
 * - `PRESENT` / `REMOTE` ⇒ on duty (REMOTE is unusual for a driver but implies no route impact).
 * - `LATE` ⇒ still driving, but the **morning** leg is at risk — Transport may need cover.
 * - `EARLY_DEPARTURE` ⇒ the **afternoon** leg is at risk.
 * - `ABSENT` / `ON_LEAVE` ⇒ unavailable for both legs; a replacement is required.
 * - `HOLIDAY` ⇒ no routes run; not an availability problem.
 */
export function resolveDriverDuty(status: StaffAttendanceStatus): DriverDutySignal {
  switch (status) {
    case 'PRESENT':
    case 'REMOTE':
      return {
        status: 'ON_DUTY',
        needsReplacement: false,
        affectedLegs: [],
        reason: 'transport.driver.onDuty',
      };
    case 'LATE':
      return {
        status: 'LATE',
        needsReplacement: false,
        affectedLegs: ['MORNING'],
        reason: 'transport.driver.late',
      };
    case 'EARLY_DEPARTURE':
      return {
        status: 'LATE',
        needsReplacement: false,
        affectedLegs: ['AFTERNOON'],
        reason: 'transport.driver.earlyDeparture',
      };
    case 'ABSENT':
      return {
        status: 'UNAVAILABLE',
        needsReplacement: true,
        affectedLegs: [...BOTH_LEGS],
        reason: 'transport.driver.absent',
      };
    case 'ON_LEAVE':
      return {
        status: 'UNAVAILABLE',
        needsReplacement: true,
        affectedLegs: [...BOTH_LEGS],
        reason: 'transport.driver.onLeave',
      };
    case 'HOLIDAY':
    default:
      return {
        status: 'ON_DUTY',
        needsReplacement: false,
        affectedLegs: [],
        reason: 'transport.driver.noService',
      };
  }
}

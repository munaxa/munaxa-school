import { EmploymentStatus } from '@prisma/client';
import {
  allowedNextStatuses,
  canTransition,
  ENTRY_STATUSES,
  EXIT_STATUSES,
  isArchived,
  stampsTerminationDate,
} from './employee-lifecycle.logic';

describe('employee lifecycle state machine', () => {
  it('permits the recruitment happy path candidate → hired', () => {
    expect(canTransition(EmploymentStatus.CANDIDATE, EmploymentStatus.INTERVIEW)).toBe(true);
    expect(canTransition(EmploymentStatus.INTERVIEW, EmploymentStatus.OFFER_SENT)).toBe(true);
    expect(canTransition(EmploymentStatus.OFFER_SENT, EmploymentStatus.OFFER_ACCEPTED)).toBe(true);
    expect(canTransition(EmploymentStatus.OFFER_ACCEPTED, EmploymentStatus.HIRED)).toBe(true);
    expect(canTransition(EmploymentStatus.HIRED, EmploymentStatus.ACTIVE)).toBe(true);
  });

  it('permits the employment happy path active → on leave → active', () => {
    expect(canTransition(EmploymentStatus.ACTIVE, EmploymentStatus.ON_LEAVE)).toBe(true);
    expect(canTransition(EmploymentStatus.ON_LEAVE, EmploymentStatus.ACTIVE)).toBe(true);
  });

  it('rejects illegal skips and reversals', () => {
    // Cannot jump from candidate straight to active.
    expect(canTransition(EmploymentStatus.CANDIDATE, EmploymentStatus.ACTIVE)).toBe(false);
    // Cannot resurrect a terminated employee back to active (must archive, then re-hire fresh).
    expect(canTransition(EmploymentStatus.TERMINATED, EmploymentStatus.ACTIVE)).toBe(false);
    // No self-transition.
    expect(canTransition(EmploymentStatus.ACTIVE, EmploymentStatus.ACTIVE)).toBe(false);
  });

  it('funnels every exit status to ARCHIVED only', () => {
    for (const exit of EXIT_STATUSES) {
      expect(allowedNextStatuses(exit)).toEqual([EmploymentStatus.ARCHIVED]);
    }
  });

  it('treats ARCHIVED as fully terminal', () => {
    expect(isArchived(EmploymentStatus.ARCHIVED)).toBe(true);
    expect(allowedNextStatuses(EmploymentStatus.ARCHIVED)).toEqual([]);
  });

  it('stamps termination date for exit statuses only', () => {
    expect(stampsTerminationDate(EmploymentStatus.TERMINATED)).toBe(true);
    expect(stampsTerminationDate(EmploymentStatus.RESIGNED)).toBe(true);
    expect(stampsTerminationDate(EmploymentStatus.RETIRED)).toBe(true);
    expect(stampsTerminationDate(EmploymentStatus.ACTIVE)).toBe(false);
    expect(stampsTerminationDate(EmploymentStatus.ON_LEAVE)).toBe(false);
  });

  it('exposes sensible entry statuses', () => {
    expect(ENTRY_STATUSES).toContain(EmploymentStatus.ACTIVE);
    expect(ENTRY_STATUSES).toContain(EmploymentStatus.CANDIDATE);
    // A mid-lifecycle status is not a valid creation state.
    expect(ENTRY_STATUSES).not.toContain(EmploymentStatus.ON_LEAVE);
  });
});

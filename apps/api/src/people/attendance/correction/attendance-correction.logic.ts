/**
 * Attendance correction workflow state machine (capability N4).
 *
 * Pure decision logic for the request → review → approval → apply lifecycle. Deliberately mirrors
 * the shape of the proven staff-leave approval chain (`currentLevel` / `requiredLevels`, advance on
 * approval, finalise on the last level) rather than introducing a generic workflow engine — the
 * repository convention is one approval chain per bounded context (see CAPABILITY_OWNERSHIP_MATRIX).
 *
 * Nothing here performs I/O, so every transition is unit-testable.
 */
import type { AttendanceCorrectionStatus } from '@prisma/client';

export interface CorrectionState {
  status: AttendanceCorrectionStatus;
  currentLevel: number;
  requiredLevels: number;
}

/** The outcome of applying a decision to a request. */
export interface CorrectionTransition {
  status: AttendanceCorrectionStatus;
  currentLevel: number;
  /** True when this decision fully approved the request and the change must now be applied. */
  shouldApply: boolean;
}

/** Only a PENDING request can be decided on. */
export function canDecide(state: CorrectionState): boolean {
  return state.status === 'PENDING';
}

/** A request can be cancelled by its requester until it has been applied or already closed. */
export function canCancel(state: CorrectionState): boolean {
  return state.status === 'PENDING' || state.status === 'APPROVED';
}

/**
 * Apply an approval. Intermediate levels advance the chain and keep the request PENDING; the final
 * level flips it to APPROVED and signals that the correction must now be applied to attendance.
 */
export function approve(state: CorrectionState): CorrectionTransition {
  const isFinal = state.currentLevel >= state.requiredLevels;
  return {
    status: isFinal ? 'APPROVED' : 'PENDING',
    currentLevel: isFinal ? state.currentLevel : state.currentLevel + 1,
    shouldApply: isFinal,
  };
}

/** A rejection closes the request at the current level regardless of how many levels remain. */
export function reject(state: CorrectionState): CorrectionTransition {
  return { status: 'REJECTED', currentLevel: state.currentLevel, shouldApply: false };
}

/** Terminal states never transition again. */
export function isTerminal(status: AttendanceCorrectionStatus): boolean {
  return status === 'REJECTED' || status === 'APPLIED' || status === 'CANCELLED';
}

/** Normalise a requested approval-level count (at least one level, capped for sanity). */
export function normaliseRequiredLevels(levels: number | undefined): number {
  if (levels === undefined || Number.isNaN(levels)) return 1;
  return Math.min(Math.max(Math.trunc(levels), 1), 5);
}

/**
 * Payroll validation gate (PR-13).
 *
 * The payroll pipeline is:
 *
 *   Attendance → **Validated Attendance** → Payroll Preparation → Payroll Calculation →
 *   Payroll Approval → Payslip Generation → Finance Posting
 *
 * This module owns the second arrow only. It answers one question — "is this period safe to hand to
 * payroll?" — as a pure, testable predicate. Everything downstream of preparation stays in Finance;
 * HR deliberately hands over a clean summary and nothing more (no money is computed here).
 */

/** A blocking reason that stops a period being handed to payroll. */
export interface ValidationIssue {
  code: 'PERIOD_NOT_LOCKED' | 'PENDING_CORRECTIONS' | 'MISSING_ATTENDANCE' | 'UNRESOLVED_PUNCHES';
  message: string;
  /** How many entities are affected (employees, days, requests…). */
  count: number;
}

export interface ValidationInput {
  /** Whole reporting range is covered by active lock(s). */
  periodFullyLocked: boolean;
  /** Correction requests still awaiting a decision inside the range. */
  pendingCorrections: number;
  /**
   * Employee-days with no attendance record inside the range. A gap is a warning, not a hard block:
   * many schools legitimately leave non-working days unmarked.
   */
  missingAttendanceDays: number;
  /** Device punches stored but not yet folded into attendance. */
  unresolvedPunches: number;
}

export interface ValidationResult {
  /** True when payroll may consume this period. */
  valid: boolean;
  /** Hard blockers — payroll must not proceed. */
  issues: ValidationIssue[];
  /** Non-blocking observations the payroll officer should see. */
  warnings: ValidationIssue[];
}

/**
 * Validate a period.
 *
 * **Blocking:** the period must be locked (otherwise attendance can still change under payroll's
 * feet) and no correction may still be undecided (its outcome would change the numbers).
 *
 * **Warnings:** missing attendance days and unprocessed device punches are surfaced but do not
 * block — they are frequently benign, and blocking on them would make payroll unrunnable.
 */
export function validatePayrollPeriod(input: ValidationInput): ValidationResult {
  const issues: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!input.periodFullyLocked) {
    issues.push({
      code: 'PERIOD_NOT_LOCKED',
      message:
        'The payroll period is not fully locked; attendance could still change after preparation.',
      count: 1,
    });
  }
  if (input.pendingCorrections > 0) {
    issues.push({
      code: 'PENDING_CORRECTIONS',
      message: 'Correction requests are still awaiting a decision inside this period.',
      count: input.pendingCorrections,
    });
  }
  if (input.missingAttendanceDays > 0) {
    warnings.push({
      code: 'MISSING_ATTENDANCE',
      message: 'Some employee-days have no attendance record in this period.',
      count: input.missingAttendanceDays,
    });
  }
  if (input.unresolvedPunches > 0) {
    warnings.push({
      code: 'UNRESOLVED_PUNCHES',
      message: 'Device punches in this period have not been processed into attendance.',
      count: input.unresolvedPunches,
    });
  }

  return { valid: issues.length === 0, issues, warnings };
}

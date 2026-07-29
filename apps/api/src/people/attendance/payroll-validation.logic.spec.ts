import { validatePayrollPeriod, type ValidationInput } from './payroll-validation.logic';

const clean: ValidationInput = {
  periodFullyLocked: true,
  pendingCorrections: 0,
  missingAttendanceDays: 0,
  unresolvedPunches: 0,
};

describe('payroll period validation', () => {
  it('passes a locked, fully-decided period', () => {
    const r = validatePayrollPeriod(clean);
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('blocks an unlocked period', () => {
    const r = validatePayrollPeriod({ ...clean, periodFullyLocked: false });
    expect(r.valid).toBe(false);
    expect(r.issues.map((i) => i.code)).toEqual(['PERIOD_NOT_LOCKED']);
  });

  it('blocks while corrections are undecided, and reports how many', () => {
    const r = validatePayrollPeriod({ ...clean, pendingCorrections: 3 });
    expect(r.valid).toBe(false);
    expect(r.issues[0]!.code).toBe('PENDING_CORRECTIONS');
    expect(r.issues[0]!.count).toBe(3);
  });

  it('reports every blocker at once rather than stopping at the first', () => {
    const r = validatePayrollPeriod({
      ...clean,
      periodFullyLocked: false,
      pendingCorrections: 1,
    });
    expect(r.issues.map((i) => i.code).sort()).toEqual([
      'PENDING_CORRECTIONS',
      'PERIOD_NOT_LOCKED',
    ]);
  });

  it('treats missing attendance as a warning, not a blocker', () => {
    const r = validatePayrollPeriod({ ...clean, missingAttendanceDays: 12 });
    expect(r.valid).toBe(true);
    expect(r.warnings[0]!.code).toBe('MISSING_ATTENDANCE');
    expect(r.warnings[0]!.count).toBe(12);
  });

  it('treats unprocessed punches as a warning, not a blocker', () => {
    const r = validatePayrollPeriod({ ...clean, unresolvedPunches: 4 });
    expect(r.valid).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(['UNRESOLVED_PUNCHES']);
  });

  it('can be valid with warnings while still blocking on a real issue elsewhere', () => {
    const r = validatePayrollPeriod({
      periodFullyLocked: false,
      pendingCorrections: 0,
      missingAttendanceDays: 2,
      unresolvedPunches: 1,
    });
    expect(r.valid).toBe(false);
    expect(r.warnings).toHaveLength(2);
  });
});

import {
  approve,
  canCancel,
  canDecide,
  isTerminal,
  normaliseRequiredLevels,
  reject,
  type CorrectionState,
} from './attendance-correction.logic';

const pending = (level = 1, required = 1): CorrectionState => ({
  status: 'PENDING',
  currentLevel: level,
  requiredLevels: required,
});

describe('attendance correction workflow', () => {
  it('allows decisions only while pending', () => {
    expect(canDecide(pending())).toBe(true);
    expect(canDecide({ ...pending(), status: 'APPROVED' })).toBe(false);
    expect(canDecide({ ...pending(), status: 'REJECTED' })).toBe(false);
    expect(canDecide({ ...pending(), status: 'APPLIED' })).toBe(false);
  });

  it('approves a single-level request straight to APPROVED and signals apply', () => {
    expect(approve(pending(1, 1))).toEqual({
      status: 'APPROVED',
      currentLevel: 1,
      shouldApply: true,
    });
  });

  it('advances a level on a multi-level chain without applying', () => {
    expect(approve(pending(1, 2))).toEqual({
      status: 'PENDING',
      currentLevel: 2,
      shouldApply: false,
    });
  });

  it('applies only on the final level of a multi-level chain', () => {
    const second = approve(pending(2, 2));
    expect(second.status).toBe('APPROVED');
    expect(second.shouldApply).toBe(true);
  });

  it('rejects immediately at any level and never applies', () => {
    expect(reject(pending(1, 3))).toEqual({
      status: 'REJECTED',
      currentLevel: 1,
      shouldApply: false,
    });
  });

  it('permits cancellation while pending or approved-but-not-applied', () => {
    expect(canCancel(pending())).toBe(true);
    expect(canCancel({ ...pending(), status: 'APPROVED' })).toBe(true);
    expect(canCancel({ ...pending(), status: 'APPLIED' })).toBe(false);
    expect(canCancel({ ...pending(), status: 'REJECTED' })).toBe(false);
  });

  it('identifies terminal states', () => {
    expect(isTerminal('REJECTED')).toBe(true);
    expect(isTerminal('APPLIED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(isTerminal('PENDING')).toBe(false);
    expect(isTerminal('APPROVED')).toBe(false);
  });

  it('normalises the required-level count', () => {
    expect(normaliseRequiredLevels(undefined)).toBe(1);
    expect(normaliseRequiredLevels(0)).toBe(1);
    expect(normaliseRequiredLevels(-3)).toBe(1);
    expect(normaliseRequiredLevels(2)).toBe(2);
    expect(normaliseRequiredLevels(2.7)).toBe(2);
    expect(normaliseRequiredLevels(99)).toBe(5);
  });
});

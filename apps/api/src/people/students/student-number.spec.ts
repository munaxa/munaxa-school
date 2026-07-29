import { formatStudentNumber } from './student-number';

describe('formatStudentNumber (Decision 6 — configurable Student Number)', () => {
  it('zero-pads to the configured length with no prefix by default', () => {
    expect(formatStudentNumber(1, null, 6)).toBe('000001');
    expect(formatStudentNumber(123, null, 6)).toBe('000123');
  });

  it('applies a prefix (e.g. "S-" or "2026-")', () => {
    expect(formatStudentNumber(1, 'S-', 6)).toBe('S-000001');
    expect(formatStudentNumber(42, '2026-', 6)).toBe('2026-000042');
  });

  it('does not truncate numbers wider than the pad length', () => {
    expect(formatStudentNumber(1234567, null, 6)).toBe('1234567');
  });

  it('supports a zero pad length (no padding)', () => {
    expect(formatStudentNumber(7, 'STD', 0)).toBe('STD7');
  });
});

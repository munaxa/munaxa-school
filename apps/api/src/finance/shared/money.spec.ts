import { fromFils, splitFils, toFils } from './money';

/** The shared money helpers are the single source for fils conversion + the installment split. */
describe('money', () => {
  it('converts JOD ↔ fils without drift', () => {
    expect(toFils('3000.000')).toBe(3_000_000);
    expect(toFils(316.667)).toBe(316_667);
    expect(fromFils(316_667).toFixed(3)).toBe('316.667');
  });

  it('splits a total into equal parts whose sum is exact (remainder to the last)', () => {
    expect(splitFils(900_000, 9)).toEqual(Array(9).fill(100_000));
    const parts = splitFils(1_000_000, 3);
    expect(parts).toEqual([333_333, 333_333, 333_334]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1_000_000);
  });

  it('returns the whole total for a single part', () => {
    expect(splitFils(2_850_000, 1)).toEqual([2_850_000]);
  });

  it('conserves the total for arbitrary counts', () => {
    for (const [total, n] of [
      [2_850_000, 9],
      [123_457, 7],
      [100, 3],
    ] as const) {
      const parts = splitFils(total, n);
      expect(parts).toHaveLength(n);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
});

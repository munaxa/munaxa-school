import type { AgingBuckets } from './collections.service';
import { agedAmount, qualifiesOutstanding } from './outstanding-filter';

function aging(over: Partial<AgingBuckets> = {}): AgingBuckets {
  return {
    studentId: 's',
    current: '0.000',
    d1_30: '0.000',
    d31_60: '0.000',
    d61_90: '0.000',
    d90plus: '0.000',
    total: '0.000',
    ...over,
  };
}

describe('agedAmount — balance aged beyond a threshold', () => {
  const a = aging({ d1_30: '10.000', d31_60: '20.000', d61_90: '30.000', d90plus: '40.000' });

  it('sums all overdue buckets when no threshold', () => {
    expect(agedAmount(a).toFixed(3)).toBe('100.000');
  });
  it('>30 days excludes the 1–30 bucket', () => {
    expect(agedAmount(a, 30).toFixed(3)).toBe('90.000');
  });
  it('>60 days keeps only 61–90 and 90+', () => {
    expect(agedAmount(a, 60).toFixed(3)).toBe('70.000');
  });
  it('>90 days keeps only 90+', () => {
    expect(agedAmount(a, 90).toFixed(3)).toBe('40.000');
  });
});

describe('qualifiesOutstanding — admin push filters', () => {
  it('rejects accounts with no outstanding balance', () => {
    expect(qualifiesOutstanding(aging(), {})).toBe(false);
  });

  it('with no filters, any positive outstanding qualifies', () => {
    expect(qualifiesOutstanding(aging({ current: '5.000', total: '5.000' }), {})).toBe(true);
  });

  it('age filter requires a balance aged beyond the threshold', () => {
    const young = aging({ d1_30: '50.000', total: '50.000' });
    expect(qualifiesOutstanding(young, { minAgeDays: 30 })).toBe(false);
    const old = aging({ d61_90: '50.000', total: '50.000' });
    expect(qualifiesOutstanding(old, { minAgeDays: 30 })).toBe(true);
    expect(qualifiesOutstanding(old, { minAgeDays: 90 })).toBe(false);
  });

  it('amount filter compares against total outstanding', () => {
    const a = aging({ current: '120.000', total: '120.000' });
    expect(qualifiesOutstanding(a, { minAmount: '100.000' })).toBe(true);
    expect(qualifiesOutstanding(a, { minAmount: '200.000' })).toBe(false);
  });

  it('combines both filters with ALL (default) — both must hold', () => {
    const a = aging({ d31_60: '40.000', current: '60.000', total: '100.000' });
    // aged>30 present (40) AND total>=100 → pass
    expect(qualifiesOutstanding(a, { minAgeDays: 30, minAmount: '100.000' })).toBe(true);
    // aged>90 absent → fail under ALL
    expect(qualifiesOutstanding(a, { minAgeDays: 90, minAmount: '100.000' })).toBe(false);
  });

  it('combines both filters with ANY — either suffices', () => {
    const a = aging({ d31_60: '40.000', current: '60.000', total: '100.000' });
    // aged>90 absent BUT total>=100 → pass under ANY
    expect(qualifiesOutstanding(a, { minAgeDays: 90, minAmount: '100.000', match: 'ANY' })).toBe(
      true,
    );
    // aged>90 absent AND total<200 → fail even under ANY
    expect(qualifiesOutstanding(a, { minAgeDays: 90, minAmount: '200.000', match: 'ANY' })).toBe(
      false,
    );
  });
});

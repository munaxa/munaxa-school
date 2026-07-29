import { Prisma } from '@prisma/client';
import type { AgingBuckets } from './collections.service';

const ZERO = new Prisma.Decimal(0);

export interface OutstandingFilter {
  minAgeDays?: 30 | 60 | 90;
  minAmount?: string;
  match?: 'ALL' | 'ANY';
}

/**
 * Outstanding balance aged strictly beyond `minAgeDays`:
 *   30 → buckets 31-60, 61-90, 90+    (overdue more than 30 days)
 *   60 → buckets 61-90, 90+           (overdue more than 60 days)
 *   90 → bucket 90+                   (overdue more than 90 days)
 *   undefined → every overdue bucket (1-30 … 90+)
 */
export function agedAmount(a: AgingBuckets, minAgeDays?: 30 | 60 | 90): Prisma.Decimal {
  const d1_30 = new Prisma.Decimal(a.d1_30);
  const d31_60 = new Prisma.Decimal(a.d31_60);
  const d61_90 = new Prisma.Decimal(a.d61_90);
  const d90plus = new Prisma.Decimal(a.d90plus);
  switch (minAgeDays) {
    case 30:
      return d31_60.plus(d61_90).plus(d90plus);
    case 60:
      return d61_90.plus(d90plus);
    case 90:
      return d90plus;
    default:
      return d1_30.plus(d31_60).plus(d61_90).plus(d90plus);
  }
}

/**
 * Whether a student's aging qualifies for an outstanding-balance push under the given filter.
 *  - age filter passes when there is a positive balance aged beyond `minAgeDays`.
 *  - amount filter passes when total outstanding ≥ `minAmount`.
 *  - with both filters present, `match` (ALL/ANY, default ALL) combines them.
 *  - with no filters, any positive outstanding balance qualifies.
 */
export function qualifiesOutstanding(a: AgingBuckets, filter: OutstandingFilter): boolean {
  const total = new Prisma.Decimal(a.total);
  if (total.lessThanOrEqualTo(ZERO)) return false;

  const ageActive = filter.minAgeDays != null;
  const amountActive = filter.minAmount != null;
  if (!ageActive && !amountActive) return true;

  const checks: boolean[] = [];
  if (ageActive) checks.push(agedAmount(a, filter.minAgeDays).greaterThan(ZERO));
  if (amountActive) checks.push(total.greaterThanOrEqualTo(new Prisma.Decimal(filter.minAmount!)));

  return (filter.match ?? 'ALL') === 'ANY' ? checks.some(Boolean) : checks.every(Boolean);
}

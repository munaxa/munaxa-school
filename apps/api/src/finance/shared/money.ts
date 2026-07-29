import { Prisma } from '@prisma/client';

/**
 * Money helpers for the AR domain. All internal arithmetic is done in integer **fils**
 * (1/1000 JOD) so installment splits and allocations never drift on rounding
 * (Finance Domain Spec v1.0 — global money invariant, IR-2). This is the single source
 * of truth for fils conversion; no other module re-implements it.
 */

export const ZERO = new Prisma.Decimal(0);

/** JOD (number or Decimal/string) → integer fils. */
export function toFils(n: number | string | Prisma.Decimal): number {
  return Math.round(Number(n) * 1000);
}

/** Integer fils → a Decimal(12,3) JOD value. */
export function fromFils(fils: number): Prisma.Decimal {
  return new Prisma.Decimal(fils).dividedBy(1000);
}

/** Present a Decimal/number as a fixed 3-dp JOD string. */
export function jod(n: number | string | Prisma.Decimal): string {
  return new Prisma.Decimal(n).toFixed(3);
}

/** max(value, 0) as a Decimal. */
export function floorZero(v: Prisma.Decimal): Prisma.Decimal {
  return Prisma.Decimal.max(v, ZERO);
}

/**
 * Split a total (in fils) into `count` equal parts, with the last part absorbing the rounding
 * remainder so the parts always reconstruct the exact total (IR-2). This is the single source of
 * the installment amount‑split — the schedule engine and every quote/agreement preview reuse it.
 */
export function splitFils(totalFils: number, count: number): number[] {
  if (count <= 1) return [totalFils];
  const per = Math.floor(totalFils / count);
  const parts: number[] = [];
  for (let i = 0; i < count - 1; i += 1) parts.push(per);
  parts.push(totalFils - per * (count - 1));
  return parts;
}

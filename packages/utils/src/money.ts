/**
 * Money helpers. JOD has 3 minor units (fils). We store/compute in minor units (integers)
 * to avoid floating-point error, and format for display.
 */

export const JOD_MINOR_UNITS = 1000; // 1 JOD = 1000 fils

/** Convert a major-unit decimal string/number (e.g. "12.500") to integer minor units. */
export function toMinorUnits(amount: string | number): number {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) throw new Error(`Invalid amount: ${amount}`);
  return Math.round(n * JOD_MINOR_UNITS);
}

/** Convert integer minor units to a major-unit number. */
export function fromMinorUnits(minor: number): number {
  return minor / JOD_MINOR_UNITS;
}

/** Format minor units as a localized JOD currency string. */
export function formatJod(minor: number, locale: 'en' | 'ar' = 'en'): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-JO' : 'en-JO', {
    style: 'currency',
    currency: 'JOD',
    minimumFractionDigits: 3,
  }).format(fromMinorUnits(minor));
}

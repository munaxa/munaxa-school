/** Formatting helpers — money (JOD, 3-dp), numbers, dates. Money is always LTR. */

export const CURRENCY = 'JOD';

/** Format a JOD amount with the design-system rule: 3 decimal places, mono, LTR. */
export function jod(value: number): string {
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} ${CURRENCY}`;
}

export function num(value: number): string {
  return value.toLocaleString('en-US');
}

export function pct(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function fmtDate(iso: string | Date): string {
  return DATE_FMT.format(typeof iso === 'string' ? new Date(iso) : iso);
}

export function fmtDateTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${fmtDate(d)} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

/** YYYY-MM-DD for <input type="date"> and stable keys. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

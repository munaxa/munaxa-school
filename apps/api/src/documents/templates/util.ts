import { DocumentLanguage } from '@prisma/client';

/** Pick a label for the requested language. BILINGUAL shows "English / العربية". */
export function L(language: DocumentLanguage, en: string, ar: string): string {
  switch (language) {
    case DocumentLanguage.AR:
      return ar;
    case DocumentLanguage.BILINGUAL:
      return `${en} / ${ar}`;
    case DocumentLanguage.EN:
    default:
      return en;
  }
}

/** Format a money figure (JOD, 3 decimals — fils precision, matching the ledger). */
export function money(value: number | string): string {
  return `${Number(value).toFixed(3)} JOD`;
}

/** Plain 3-decimal number (for table cells where the JOD suffix would be noisy). */
export function amount(value: number | string): string {
  return Number(value).toFixed(3);
}

export function dateStr(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

/** Display form of a gapless document/agreement number: prefix + zero-padded. */
export function docNumber(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(6, '0')}`;
}

export function fullNameEn(p: { firstNameEn: string; lastNameEn: string }): string {
  return `${p.firstNameEn} ${p.lastNameEn}`.trim();
}

export function fullNameAr(p: { firstNameAr: string; lastNameAr: string }): string {
  return `${p.firstNameAr} ${p.lastNameAr}`.trim();
}

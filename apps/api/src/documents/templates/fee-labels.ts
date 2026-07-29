import type { DocumentLanguage } from '@prisma/client';
import { FeeItemKind } from '@prisma/client';
import { L } from './util';

/** Bilingual labels for each fee category. */
const KIND_LABELS: Record<FeeItemKind, { en: string; ar: string }> = {
  REGISTRATION: { en: 'Registration Fee', ar: 'رسوم التسجيل' },
  TUITION: { en: 'Tuition', ar: 'الرسوم الدراسية' },
  BOOKS: { en: 'Books', ar: 'الكتب' },
  UNIFORM: { en: 'Uniform', ar: 'الزي المدرسي' },
  INSURANCE: { en: 'Insurance', ar: 'التأمين' },
  ACTIVITY: { en: 'Activities', ar: 'الأنشطة' },
  TECHNOLOGY: { en: 'Technology', ar: 'التكنولوجيا' },
  EXAM: { en: 'Exams', ar: 'الامتحانات' },
  LABORATORY: { en: 'Laboratory', ar: 'المختبرات' },
  TRANSPORT: { en: 'Transportation', ar: 'النقل' },
  CUSTOM: { en: 'Other Fees', ar: 'رسوم أخرى' },
};

export function feeKindLabel(kind: FeeItemKind, language: DocumentLanguage): string {
  const l = KIND_LABELS[kind] ?? KIND_LABELS.CUSTOM;
  return L(language, l.en, l.ar);
}

/** Categories that count as "tuition" for the Annual Tuition Certificate's mandatory line. */
export const TUITION_KINDS: ReadonlySet<FeeItemKind> = new Set([FeeItemKind.TUITION]);

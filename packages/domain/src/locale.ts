/** Supported locales and text direction for Munaxa (Jordan market: Arabic + English). */

export const Locale = {
  EN: 'en',
  AR: 'ar',
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];

export const SUPPORTED_LOCALES: Locale[] = Object.values(Locale);
export const DEFAULT_LOCALE: Locale = Locale.EN;

export type TextDirection = 'ltr' | 'rtl';

export function directionForLocale(locale: Locale): TextDirection {
  return locale === Locale.AR ? 'rtl' : 'ltr';
}

/** A localized string pair used across business entities (e.g. name_en / name_ar). */
export interface LocalizedText {
  en: string;
  ar: string;
}

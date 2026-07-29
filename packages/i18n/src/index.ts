import en from './locales/en.json' with { type: 'json' };
import ar from './locales/ar.json' with { type: 'json' };
import { Locale, DEFAULT_LOCALE, directionForLocale } from '@school/domain';

export type Messages = typeof en;

export const messages: Record<Locale, Messages> = {
  en,
  ar,
};

export function getMessages(locale: Locale): Messages {
  return messages[locale] ?? messages[DEFAULT_LOCALE];
}

export { Locale, DEFAULT_LOCALE, directionForLocale };

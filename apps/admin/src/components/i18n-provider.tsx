'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getMessages } from '@school/i18n';
import { LocaleProvider } from '@axa/platform';
import { DEFAULT_LOCALE, directionForLocale, type Locale } from '@/lib/i18n';

const LOCALE_KEY = 'munaxa.locale';

/**
 * BCP-47 tag for the Platform date engine, keyed to Munaxa's market.
 *
 * The app's two languages are `en` and `ar`, but the date conventions that matter here — the week
 * starting on Saturday, the day-before-month field order — are Jordan's, and they are the same in
 * both languages. Pinning the region to `JO` is School owning its behaviour: it is the deliberate
 * reason a picker parses `3/4` as April and opens on a Saturday-first grid, rather than inheriting
 * whatever region the visitor's browser happens to report.
 */
const DATE_LOCALE: Record<Locale, string> = { en: 'en-JO', ar: 'ar-JO' };

interface I18nApi {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Translate a dot-path key (e.g. "nav.finance"); falls back to the key when missing. */
  t: (path: string) => string;
}

const I18nContext = createContext<I18nApi | null>(null);

export function useI18n(): I18nApi {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>');
  return ctx;
}

function resolve(obj: unknown, path: string): string {
  const val = path
    .split('.')
    .reduce<unknown>(
      (acc, k) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined,
      obj,
    );
  return typeof val === 'string' ? val : path;
}

function applyLocale(locale: Locale) {
  const el = document.documentElement;
  el.lang = locale;
  el.dir = directionForLocale(locale);
}

/**
 * Client i18n provider. Holds the active locale (persisted), applies dir/lang to <html>, and
 * exposes `t()` from the @school/i18n catalog. Switching locale re-renders the tree, so all
 * translated strings + text direction update together.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const saved = (localStorage.getItem(LOCALE_KEY) as Locale | null) ?? DEFAULT_LOCALE;
    setLocaleState(saved);
    applyLocale(saved);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(LOCALE_KEY, l);
    applyLocale(l);
  }, []);

  const messages = getMessages(locale);
  const t = useCallback((path: string) => resolve(messages, path), [messages]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {/*
        Every Platform date control below resolves its locale, direction and week start from here,
        so a date reads the same way — and parses the same way — on every screen, in whichever
        language the user has chosen.
      */}
      <LocaleProvider locale={DATE_LOCALE[locale]} direction={directionForLocale(locale)}>
        {children}
      </LocaleProvider>
    </I18nContext.Provider>
  );
}

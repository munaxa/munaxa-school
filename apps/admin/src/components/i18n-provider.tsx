'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getMessages } from '@school/i18n';
import { DEFAULT_LOCALE, directionForLocale, type Locale } from '@/lib/i18n';

const LOCALE_KEY = 'munaxa.locale';

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

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

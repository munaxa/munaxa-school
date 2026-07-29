'use client';

import { useTheme, Button } from '@axa/platform';
import { useI18n } from './i18n-provider';

const THEME_KEY = 'munaxa.theme';

/**
 * Theme (light/dark) and locale (EN/AR → LTR/RTL) switcher for the shell top bar. Theme is
 * handled by the design system's `useTheme` (same storage key as before); locale is driven
 * through the i18n provider so the whole app re-translates and flips direction together.
 * Both persist to localStorage.
 */
export function ThemeLocaleToggle() {
  const { locale, setLocale } = useI18n();
  const { scheme, toggle } = useTheme({ storageKey: THEME_KEY });

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
        aria-label="Toggle language"
      >
        {locale === 'ar' ? 'AR' : 'EN'}
      </Button>
      <Button variant="ghost" size="sm" onClick={toggle} aria-label="Toggle theme">
        {scheme === 'dark' ? '☾' : '☀'}
      </Button>
    </div>
  );
}

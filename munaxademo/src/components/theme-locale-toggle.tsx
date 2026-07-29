'use client';

import { useSession } from '@/lib/session-context';
import { Button } from '@axa/platform';

/** Theme (light/dark) + locale (EN/AR → LTR/RTL) switcher, wired to the session context. */
export function ThemeLocaleToggle() {
  const { locale, setLocale, theme, toggleTheme } = useSession();
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
      <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === 'dark' ? '☾' : '☀'}
      </Button>
    </div>
  );
}

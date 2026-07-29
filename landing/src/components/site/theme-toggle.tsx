'use client';

import { Moon, Sun } from '@axa/platform/icons';
import { useTheme } from '@axa/platform';

/** Minimal light/dark switch. Persists to localStorage; the no-flash script in layout applies it. */
export function ThemeToggle() {
  const { scheme, toggle } = useTheme({ storageKey: 'munaxa-theme', source: 'document' });
  const dark = scheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition hover:text-foreground"
    >
      {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}

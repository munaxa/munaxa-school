'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { academicYearsApi, type AcademicYear } from '@/lib/structure';

interface CurrentYearApi {
  /** `undefined` while the first fetch is in flight, `null` when no year is ACTIVE. */
  year: AcademicYear | null | undefined;
  /** Re-read the current year from the API (e.g. right after activating or closing one). */
  refresh: () => void;
}

const CurrentYearContext = createContext<CurrentYearApi | null>(null);

/**
 * The ACTIVE academic year, resolved once per session and shared by everything that displays it
 * (today: the top-bar indicator). Kept in a provider — rather than fetched inside the indicator —
 * so a screen that *changes* the active year can push the new one into the chrome immediately
 * instead of leaving a stale badge until the next full page load.
 */
export function CurrentYearProvider({ children }: { children: React.ReactNode }) {
  const [year, setYear] = useState<AcademicYear | null | undefined>(undefined);

  const refresh = useCallback(() => {
    academicYearsApi
      .current()
      .then(setYear)
      .catch(() => setYear(null));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <CurrentYearContext.Provider value={{ year, refresh }}>{children}</CurrentYearContext.Provider>
  );
}

/** Read the ACTIVE academic year inside the app shell. */
export function useCurrentYear(): CurrentYearApi {
  const ctx = useContext(CurrentYearContext);
  if (!ctx) throw new Error('useCurrentYear must be used within <CurrentYearProvider>');
  return ctx;
}

/**
 * Refresher for screens that mutate the academic year's lifecycle. Safe to call from anywhere:
 * outside the shell (a page rendered without the chrome) it is a no-op instead of throwing.
 */
export function useCurrentYearRefresh(): () => void {
  const ctx = useContext(CurrentYearContext);
  return useCallback(() => ctx?.refresh(), [ctx]);
}

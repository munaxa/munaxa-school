'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { dashboardApi } from '@/lib/dashboard';

/**
 * Session-wide "Privacy Mode" for sensitive financial figures. When enabled (the default),
 * money values render masked so they can't be read over the shoulder. An authorised user
 * (finance:read) can reveal a given widget for the session; every reveal is written to the
 * server audit log. Masking is a display convenience only — the real guarantee is server-side:
 * users without finance:read never receive the numbers at all.
 */
interface PrivacyContextValue {
  /** True while figures should be masked. */
  enabled: boolean;
  /** Toggle Privacy Mode. Turning it off reveals (and audits) everything for the session. */
  toggle: () => void;
  /** Whether a given scope is currently masked. */
  isMasked: (scope: string) => boolean;
  /** Reveal one scope for this session (audited server-side). */
  reveal: (scope: string) => void;
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null);
const STORAGE_KEY = 'munaxa.privacy';
const ALL = '*';

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Default to masked; only an explicit "0" opts out.
    setEnabled(localStorage.getItem(STORAGE_KEY) !== '0');
  }, []);

  const reveal = useCallback((scope: string) => {
    setRevealed((prev) => {
      if (prev.has(scope) || prev.has(ALL)) return prev;
      const next = new Set(prev);
      next.add(scope);
      return next;
    });
    // Fire-and-forget audit; failure must not block the UI (the user is already authorised).
    void dashboardApi.reveal(scope).catch(() => undefined);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((on) => {
      const next = !on;
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      if (next) {
        // Re-masking clears any session reveals.
        setRevealed(new Set());
      } else {
        // Revealing everything is itself an audited action.
        setRevealed(new Set([ALL]));
        void dashboardApi.reveal(ALL).catch(() => undefined);
      }
      return next;
    });
  }, []);

  const isMasked = useCallback(
    (scope: string) => enabled && !revealed.has(scope) && !revealed.has(ALL),
    [enabled, revealed],
  );

  const value = useMemo<PrivacyContextValue>(
    () => ({ enabled, toggle, isMasked, reveal }),
    [enabled, toggle, isMasked, reveal],
  );

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error('usePrivacy must be used within a PrivacyProvider');
  return ctx;
}

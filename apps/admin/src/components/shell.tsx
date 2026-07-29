'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IDLE_TIMEOUT_MS, logout, type Principal } from '@/lib/auth';
import { clearPrincipalCache, loadPrincipal } from '@/lib/session';
import { AppShell } from './app-shell';
import { PrivacyProvider } from './privacy-provider';
import { Spinner } from '@axa/platform';

/** User-activity events that reset the inactivity countdown. */
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

/**
 * Signs the user out after {@link IDLE_TIMEOUT_MS} of no interaction. The timer is reset
 * on any tracked activity event; on expiry we revoke the session and redirect to /login.
 */
function useIdleLogout(active: boolean): void {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!active) return;

    const signOut = () => {
      void logout().finally(() => {
        clearPrincipalCache();
        router.replace('/login');
      });
    };
    const reset = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(signOut, IDLE_TIMEOUT_MS);
    };

    reset();
    for (const evt of ACTIVITY_EVENTS) window.addEventListener(evt, reset, { passive: true });
    return () => {
      clearTimeout(timer.current);
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, reset);
    };
  }, [active, router]);
}

const PrincipalContext = createContext<Principal | null>(null);

/**
 * True once a {@link Shell} has mounted the app chrome higher in the tree (the `(app)` route-group
 * layout). Individual pages still wrap their content in `<Shell>`, but when one is already mounted
 * above them they render as a pass-through — so the sidebar/auth live in the persistent layout and
 * survive client-side navigation (no remount, no scroll reset, no auth re-fetch flash) instead of
 * being torn down and rebuilt on every page change.
 */
const ShellMountedContext = createContext(false);

/** Read the authenticated principal inside a {@link Shell}. */
export function usePrincipal(): Principal {
  const principal = useContext(PrincipalContext);
  if (!principal) throw new Error('usePrincipal must be used within <Shell>');
  return principal;
}

/**
 * Auth-guarded application shell for every signed-in page. The persistent `(app)` layout renders
 * the top-level instance (resolves the principal once and mounts the {@link AppShell} chrome);
 * any `<Shell>` left inside a page detects that and just renders its children, so the chrome is
 * never duplicated and never remounts on navigation.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const mounted = useContext(ShellMountedContext);
  if (mounted) return <>{children}</>;
  return (
    <ShellMountedContext.Provider value={true}>
      <ShellGuard>{children}</ShellGuard>
    </ShellMountedContext.Provider>
  );
}

/**
 * Redirects to /login when there's no session, resolves the principal once (cached), and renders
 * the {@link AppShell} chrome around the page. Page content reads the principal via
 * {@link usePrincipal}.
 */
function ShellGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [loading, setLoading] = useState(true);

  useIdleLogout(Boolean(principal));

  useEffect(() => {
    // The session lives in httpOnly cookies (not readable here), so we just try to resolve the
    // principal: success means a valid cookie session; failure (401 after refresh) → /login.
    loadPrincipal()
      .then((p) => {
        // Temporary-password accounts are locked to the mandatory password-change screen — they
        // cannot reach any protected page until they set a new password (the API enforces the same
        // via MustChangePasswordGuard; this is the matching client-side redirect).
        if (p.mustChangePassword) {
          router.replace('/change-password');
          return;
        }
        setPrincipal(p);
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !principal) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }

  return (
    <PrincipalContext.Provider value={principal}>
      <PrivacyProvider>
        <AppShell principal={principal}>{children}</AppShell>
      </PrivacyProvider>
    </PrincipalContext.Provider>
  );
}

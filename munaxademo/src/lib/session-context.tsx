'use client';

/**
 * Client session context: the active persona (role being explored), the demo
 * organization name from the signed cookie, plus locale (EN/AR → LTR/RTL) and theme.
 * Persona + UI prefs live in sessionStorage, so closing the browser clears them — and
 * with the session cookie also gone, the next visit starts fresh.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { PERSONA_BY_ID, personaPermissions, type Persona, type PersonaId } from '@/lib/rbac';
import {
  DEFAULT_LOCALE,
  directionForLocale,
  getMessages,
  resolveMessage,
  type Locale,
} from '@/lib/i18n';
import { useDemo } from '@/lib/demo-store/context';

const PERSONA_KEY = 'munaxa.demo.persona';
const LOCALE_KEY = 'munaxa.demo.locale';
const THEME_KEY = 'munaxa.demo.theme';
type Theme = 'light' | 'dark';

interface SessionValue {
  org: string;
  isAdmin: boolean;
  persona: Persona;
  /** True when the account is locked to a single assigned role (no switching). */
  locked: boolean;
  permissions: string[];
  setPersona: (id: PersonaId) => void;
  can: (perm?: string) => boolean;
  locale: Locale;
  setLocale: (l: Locale) => void;
  theme: Theme;
  toggleTheme: () => void;
  t: (path: string) => string;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}

export function SessionProvider({
  org,
  isAdmin,
  assignedRole,
  children,
}: {
  org: string;
  isAdmin: boolean;
  assignedRole: PersonaId | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const { actions } = useDemo();
  // Only the demo-admin console may switch roles. Every prospect session is pinned to
  // a single persona — their assigned role, or (for accounts without one) the role they
  // picked at login — so a Student can never switch to, or see, another role's data.
  const locked = !isAdmin;
  const [personaId, setPersonaId] = useState<PersonaId>(assignedRole ?? 'owner');
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    // An assigned role always wins; otherwise restore the persona chosen at login.
    if (assignedRole) {
      setPersonaId(assignedRole);
    } else {
      const p = sessionStorage.getItem(PERSONA_KEY) as PersonaId | null;
      if (p && PERSONA_BY_ID[p]) setPersonaId(p);
    }
    const l = (sessionStorage.getItem(LOCALE_KEY) as Locale | null) ?? DEFAULT_LOCALE;
    setLocaleState(l);
    applyLocale(l);
    const th = (sessionStorage.getItem(THEME_KEY) as Theme | null) ?? 'dark';
    setTheme(th);
    document.documentElement.classList.toggle('dark', th === 'dark');
  }, [assignedRole]);

  const setPersona = useCallback(
    (idValue: PersonaId) => {
      if (locked) return; // only the admin console can switch roles
      setPersonaId(idValue);
      sessionStorage.setItem(PERSONA_KEY, idValue);
    },
    [locked],
  );

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    sessionStorage.setItem(LOCALE_KEY, l);
    applyLocale(l);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      sessionStorage.setItem(THEME_KEY, next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    // Reset session-only data and clear persona/prefs, then leave the app.
    actions.reset();
    sessionStorage.removeItem(PERSONA_KEY);
    router.replace('/login');
  }, [actions, router]);

  const value = useMemo<SessionValue>(() => {
    const persona = PERSONA_BY_ID[personaId];
    const permissions = personaPermissions(personaId);
    const messages = getMessages(locale);
    return {
      org,
      isAdmin,
      persona,
      locked,
      permissions,
      setPersona,
      can: (perm?: string) => !perm || (permissions as string[]).includes(perm),
      locale,
      setLocale,
      theme,
      toggleTheme,
      t: (path: string) => resolveMessage(messages, path),
      logout,
    };
  }, [org, isAdmin, locked, personaId, locale, theme, setPersona, setLocale, toggleTheme, logout]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

function applyLocale(locale: Locale) {
  const el = document.documentElement;
  el.lang = locale;
  el.dir = directionForLocale(locale);
}

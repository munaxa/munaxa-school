'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/session-context';
import type { PersonaId } from '@/lib/rbac';
import { Button } from '@axa/platform';
import { Logo } from './logo';

const SEEN_KEY = 'munaxa.demo.onboarded';

interface Module {
  href: string;
  title: string;
  desc: string;
  perm?: string;
  personas?: PersonaId[];
}

const MODULES: Module[] = [
  {
    href: '/admissions',
    title: 'Admissions',
    desc: 'A full enquiry-to-enrolment pipeline with stages and offers.',
    perm: 'student:manage',
  },
  {
    href: '/students',
    title: 'Student Information System',
    desc: 'The single record of every student, parent and section.',
    perm: 'student:manage',
  },
  {
    href: '/attendance',
    title: 'Attendance',
    desc: 'Daily homeroom marking, history and live rates.',
    perm: 'attendance:read',
  },
  {
    href: '/finance',
    title: 'Finance',
    desc: 'Tuition invoices, payments, balances and collections.',
    perm: 'finance:read',
  },
  {
    href: '/hr',
    title: 'HR & Staff',
    desc: 'Employee records, departments, contracts and leave.',
    perm: 'employee:manage',
  },
  {
    href: '/portal/parent',
    title: 'Parent Portal',
    desc: 'What families see — children, fees and messages.',
    personas: ['parent'],
  },
  {
    href: '/portal/teacher',
    title: 'Teacher Portal',
    desc: 'Class lists, grade entry and homework.',
    personas: ['teacher'],
  },
  {
    href: '/portal/student',
    title: 'Student Portal',
    desc: 'Timetable, grades and achievements.',
    personas: ['student'],
  },
  {
    href: '/transport',
    title: 'Transport',
    desc: 'Buses, routes, drivers and live boarding scans.',
    perm: 'bus:read',
  },
  {
    href: '/reports',
    title: 'Reports',
    desc: 'Academic, attendance and financial reports.',
    perm: 'report:read',
  },
  {
    href: '/analytics',
    title: 'Analytics',
    desc: 'Dashboards, KPIs and charts across the school.',
    perm: 'report:read',
  },
];

interface OnboardingApi {
  open: () => void;
}
const OnboardingContext = createContext<OnboardingApi | null>(null);
export function useOnboarding(): OnboardingApi {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within <OnboardingProvider>');
  return ctx;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { persona, can, org } = useSession();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(SEEN_KEY)) setOpen(true);
  }, []);

  const close = useCallback(() => {
    sessionStorage.setItem(SEEN_KEY, '1');
    setOpen(false);
  }, []);

  const api = useMemo<OnboardingApi>(() => ({ open: () => setOpen(true) }), []);

  const modules = MODULES.filter((m) => {
    if (m.personas && !m.personas.includes(persona.id)) return false;
    return can(m.perm);
  });

  return (
    <OnboardingContext.Provider value={api}>
      {children}
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-900/70 p-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-start gap-4">
              <Logo size={56} priority />
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-semibold">Welcome to the Munaxa demo</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  You’re exploring <span className="font-medium text-foreground">{org}</span> as a{' '}
                  <span className="font-medium text-foreground">{persona.nameEn}</span>. This is a
                  live, fully-interactive demonstration of Munaxa Academy — a fictional school with
                  realistic data. Try anything: create, edit and delete records freely. Nothing is
                  saved, and you can reset at any time from the banner.
                </p>
              </div>
            </div>

            <h3 className="mt-6 font-mono text-xs uppercase tracking-wide text-muted-foreground">
              Jump into a module
            </h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {modules.map((m) => (
                <Link
                  key={m.href}
                  href={m.href as never}
                  onClick={close}
                  className="group rounded-xl border border-border bg-background/40 p-3 transition hover:border-primary/40 hover:shadow-glow"
                >
                  <p className="font-display text-sm font-semibold group-hover:text-primary-strong">
                    {m.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </Link>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button onClick={close}>Get started</Button>
            </div>
          </div>
        </div>
      ) : null}
    </OnboardingContext.Provider>
  );
}

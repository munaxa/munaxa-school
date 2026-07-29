'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, cn } from '@axa/platform';
import { useSession } from '@/lib/session-context';
import { useDemo } from '@/lib/demo-store/context';
import type { PersonaId } from '@/lib/rbac';
import { Logo } from './logo';
import { ThemeLocaleToggle } from './theme-locale-toggle';
import { RoleSwitcher } from './role-switcher';
import { useOnboarding } from './onboarding-tour';

interface NavItem {
  href: string;
  labelKey: string;
  perm?: string;
  personas?: PersonaId[];
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav.dashboard' },
  { href: '/admissions', labelKey: 'nav.admissions', perm: 'student:manage' },
  { href: '/students', labelKey: 'nav.students', perm: 'student:manage' },
  { href: '/attendance', labelKey: 'nav.attendance', perm: 'attendance:read' },
  { href: '/academics', labelKey: 'nav.academics', perm: 'grade:read' },
  { href: '/finance', labelKey: 'nav.finance', perm: 'finance:read' },
  { href: '/hr', labelKey: 'nav.hr', perm: 'employee:manage' },
  { href: '/transport', labelKey: 'nav.transport', perm: 'bus:read' },
  { href: '/library', labelKey: 'nav.library', perm: 'library:read' },
  { href: '/communication', labelKey: 'nav.communication', perm: 'announcement:read' },
  { href: '/events', labelKey: 'nav.events' },
  { href: '/reports', labelKey: 'nav.reports', perm: 'report:read' },
  { href: '/analytics', labelKey: 'nav.analytics', perm: 'report:read' },
  { href: '/portal/parent', labelKey: 'nav.parentPortal', personas: ['parent'] },
  { href: '/portal/student', labelKey: 'nav.studentPortal', personas: ['student'] },
  { href: '/portal/teacher', labelKey: 'nav.teacherPortal', personas: ['teacher'] },
  { href: '/admin/requests', labelKey: 'nav.requests', adminOnly: true },
  { href: '/admin/accounts', labelKey: 'nav.accounts', adminOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t, can, persona, org, isAdmin, locked, locale, logout } = useSession();
  const { data } = useDemo();
  const onboarding = useOnboarding();
  const [navOpen, setNavOpen] = useState(false);

  const items = NAV.filter((i) => {
    if (i.adminOnly && !isAdmin) return false;
    if (i.personas && !i.personas.includes(persona.id)) return false;
    return can(i.perm);
  });

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const navLinks = (
    <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href as never}
          onClick={() => setNavOpen(false)}
          className={cn(
            'rounded-lg px-3 py-2 text-sm transition',
            isActive(item.href)
              ? 'bg-secondary/80 font-medium text-foreground'
              : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
          )}
        >
          {t(item.labelKey)}
        </Link>
      ))}
    </nav>
  );

  const personaFooter = (
    <div className="mt-4 rounded-lg border border-border bg-background/40 p-3 text-xs">
      <p className="font-medium text-foreground">{persona.displayName}</p>
      <p className="truncate text-muted-foreground">
        {locale === 'ar' ? persona.nameAr : persona.nameEn}
      </p>
      <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground/70">{org}</p>
    </div>
  );

  return (
    <div className="flex min-h-[calc(100vh-2.25rem)]">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-e border-border bg-card/40 p-4 md:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 py-3">
          <Logo variant="horizontal" size={24} priority />
          <span className="font-display text-lg font-semibold">{data.school.nameEn}</span>
        </Link>
        {navLinks}
        {personaFooter}
      </aside>

      {/* Mobile drawer */}
      {navOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-ink-900/70 backdrop-blur-sm"
            onClick={() => setNavOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 start-0 flex w-72 max-w-[82%] flex-col border-e border-border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center gap-2 px-1 py-1">
                <Logo variant="horizontal" size={22} priority />
                <span className="font-display text-base font-semibold">{data.school.nameEn}</span>
              </Link>
              <button
                onClick={() => setNavOpen(false)}
                aria-label="Close menu"
                className="rounded-md px-2 py-1 text-muted-foreground transition hover:bg-secondary/50 hover:text-foreground"
              >
                ✕
              </button>
            </div>
            {navLinks}
            {personaFooter}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNavOpen(true)}
              aria-label="Open menu"
              className="rounded-md p-2 text-muted-foreground transition hover:bg-secondary/50 hover:text-foreground md:hidden"
            >
              {/* hamburger */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span className="font-display text-sm font-medium text-muted-foreground md:hidden">
              {data.school.nameEn}
            </span>
          </div>

          <div className="ms-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">Viewing as</span>
            {locked ? (
              <span className="rounded-lg border border-border px-2.5 py-1.5 text-sm">
                {locale === 'ar' ? persona.nameAr : persona.nameEn}
              </span>
            ) : (
              <RoleSwitcher />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onboarding.open}
              aria-label="Open guided walkthrough"
            >
              Guide
            </Button>
            <ThemeLocaleToggle />
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              {t('common.signOut')}
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

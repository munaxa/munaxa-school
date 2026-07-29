'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import {
  AppShell as PlatformAppShell,
  AppShellProvider,
  NavigationDrawer,
  Sidebar,
  SidebarNav,
  SidebarTrigger,
  TopBar,
  Button,
  useAppShell,
  type NavigationGroup,
  type RenderNavigationLink,
} from '@axa/platform';
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

/**
 * The platform imports no router, so the link element comes from here. Next's typed routes cannot
 * see hrefs coming from this static table, hence the cast — the same one the old shell carried.
 */
const renderLink: RenderNavigationLink = ({ href, children, ...rest }) => (
  <Link href={href as never} {...rest}>
    {children}
  </Link>
);

/** Closes the drawer on navigation, so it does not stay open over the page that just loaded. */
function CloseDrawerOnRouteChange() {
  const { setDrawerOpen } = useAppShell();
  const pathname = usePathname();
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, setDrawerOpen]);
  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t, can, persona, org, isAdmin, locked, locale, logout } = useSession();
  const { data } = useDemo();
  const onboarding = useOnboarding();

  // Permission, persona and admin filtering are business rules and stay here. The platform
  // receives navigation that is already resolved.
  const groups = useMemo<NavigationGroup[]>(() => {
    const isActive = (href: string) =>
      href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
    const items = NAV.filter((item) => {
      if (item.adminOnly && !isAdmin) return false;
      if (item.personas && !item.personas.includes(persona.id)) return false;
      return can(item.perm);
    }).map((item) => ({
      href: item.href,
      label: t(item.labelKey),
      active: isActive(item.href),
    }));
    return [{ items }];
  }, [pathname, isAdmin, persona.id, can, t]);

  const brand = (
    <Link href="/dashboard" className="flex items-center gap-2">
      <Logo variant="horizontal" size={24} priority />
      <span className="truncate font-display text-lg font-semibold">{data.school.nameEn}</span>
    </Link>
  );

  const personaFooter = (
    <div className="rounded-lg border border-border bg-background/40 p-3 text-xs">
      <p className="font-medium text-foreground">{persona.displayName}</p>
      <p className="truncate text-muted-foreground">
        {locale === 'ar' ? persona.nameAr : persona.nameEn}
      </p>
      <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground/70">{org}</p>
    </div>
  );

  const navLabel = t('nav.dashboard');

  return (
    <AppShellProvider>
      <CloseDrawerOnRouteChange />
      <PlatformAppShell
        className="min-h-[calc(100vh-2.25rem)]"
        sidebar={
          <Sidebar brand={brand} footer={personaFooter} collapsible={false}>
            <SidebarNav groups={groups} label={navLabel} renderLink={renderLink} />
          </Sidebar>
        }
        drawer={
          <NavigationDrawer label={navLabel} brand={brand} footer={personaFooter}>
            <SidebarNav
              groups={groups}
              label={navLabel}
              renderLink={renderLink}
              collapsed={false}
            />
          </NavigationDrawer>
        }
        topBar={
          <TopBar
            actions={
              <>
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
              </>
            }
          >
            <SidebarTrigger label="Open menu" />
            <span className="font-display text-sm font-medium text-muted-foreground md:hidden">
              {data.school.nameEn}
            </span>
          </TopBar>
        }
      >
        <div className="p-4 sm:p-6">{children}</div>
      </PlatformAppShell>
    </AppShellProvider>
  );
}

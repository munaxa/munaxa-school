'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AppShell as PlatformAppShell,
  AppShellProvider,
  Badge,
  Button,
  NavigationDrawer,
  Sidebar,
  SidebarNav,
  SidebarTrigger,
  TopBar,
  cn,
  type NavigationGroup,
  type RenderNavigationLink,
} from '@axa/platform';
import { logout, type Principal } from '@/lib/auth';
import { clearPrincipalCache } from '@/lib/session';
import { advancedApi } from '@/lib/advanced';
import { academicYearsApi, type AcademicYear } from '@/lib/structure';
import { Logo } from './logo';
import { ThemeLocaleToggle } from './theme-locale-toggle';
import { GlobalSearch } from './global-search';
import { useI18n } from './i18n-provider';
import { NavIcon, type NavIconKey } from './nav-icons';
import { usePrivacy } from './privacy-provider';

interface NavItem {
  href: string;
  labelKey: string;
  /** Sidebar icon (see nav-icons.tsx). */
  icon: NavIconKey;
  /** Permission required to see this item; omitted = always visible. */
  perm?: string;
  /** Feature flag gating this item; when set, the item is hidden unless the flag is enabled. */
  flag?: string;
}

/** Enterprise grouped navigation (Munaxa DS ENTERPRISE_NAVIGATION): items organised by domain
 *  under section headers. A section is hidden entirely when none of its items are permitted. */
interface NavGroup {
  titleKey?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  { items: [{ href: '/', labelKey: 'nav.dashboard', icon: 'dashboard' }] },
  {
    titleKey: 'nav.section.me',
    items: [
      { href: '/me/hr', labelKey: 'nav.myHr', icon: 'employees', perm: 'ess:read' },
      { href: '/me/team', labelKey: 'nav.myTeam', icon: 'employees', perm: 'team:read' },
    ],
  },
  {
    titleKey: 'nav.section.people',
    items: [
      {
        href: '/admissions',
        labelKey: 'nav.admissions',
        icon: 'enrollment',
        perm: 'enrollment:manage',
      },
      {
        href: '/admissions/approvals',
        labelKey: 'nav.feeApprovals',
        icon: 'finance',
        perm: 'finance:approve',
      },
      {
        href: '/people/students',
        labelKey: 'nav.people',
        icon: 'students',
        perm: 'student:manage',
      },
      {
        href: '/people/teachers',
        labelKey: 'nav.teachers',
        icon: 'teachers',
        perm: 'teacher:manage',
      },
      { href: '/people/parents', labelKey: 'nav.parents', icon: 'parents', perm: 'parent:manage' },
      { href: '/people/employees', labelKey: 'nav.hr', icon: 'employees', perm: 'employee:read' },
      {
        href: '/people/hr-dashboard',
        labelKey: 'nav.hrDashboard',
        icon: 'dashboard',
        perm: 'hr:dashboard:read',
      },
      { href: '/people/org', labelKey: 'nav.organization', icon: 'employees', perm: 'hr:org:read' },
      { href: '/people/leave', labelKey: 'nav.leave', icon: 'employees', perm: 'staff-leave:read' },
      {
        href: '/people/payroll',
        labelKey: 'nav.payroll',
        icon: 'employees',
        perm: 'payroll:prepare',
      },
      {
        href: '/people/attendance-ops',
        labelKey: 'nav.attendanceOps',
        icon: 'employees',
        perm: 'staff-attendance:read',
      },
      {
        href: '/people/performance',
        labelKey: 'nav.performance',
        icon: 'employees',
        perm: 'performance:read',
      },
      {
        href: '/people/training',
        labelKey: 'nav.training',
        icon: 'employees',
        perm: 'training:read',
      },
      { href: '/people/assets', labelKey: 'nav.assets', icon: 'inventory', perm: 'asset:read' },
      {
        href: '/people/recruitment',
        labelKey: 'nav.recruitment',
        icon: 'enrollment',
        perm: 'recruitment:read',
      },
      { href: '/people/cards', labelKey: 'nav.cards', icon: 'cards', perm: 'card:read' },
    ],
  },
  {
    titleKey: 'nav.section.academics',
    items: [
      { href: '/timetable', labelKey: 'nav.timetable', icon: 'timetable', perm: 'timetable:read' },
      {
        href: '/attendance',
        labelKey: 'nav.attendance',
        icon: 'attendance',
        perm: 'attendance:read',
      },
      { href: '/presence', labelKey: 'nav.presence', icon: 'presence', perm: 'presence:read' },
      { href: '/academics', labelKey: 'nav.academics', icon: 'academics', perm: 'grade:read' },
    ],
  },
  {
    titleKey: 'nav.section.finance',
    items: [
      { href: '/finance', labelKey: 'nav.finance', icon: 'finance', perm: 'finance:read' },
      {
        href: '/finance/collections',
        labelKey: 'nav.collections',
        icon: 'collections',
        perm: 'finance:read',
      },
      {
        href: '/finance/reports',
        labelKey: 'nav.financeReports',
        icon: 'collections',
        perm: 'finance:read',
      },
      {
        href: '/finance/fee-config',
        labelKey: 'nav.feeConfig',
        icon: 'feeConfig',
        perm: 'finance:manage',
      },
      {
        href: '/settings/fee-catalog',
        labelKey: 'nav.feeCatalog',
        icon: 'feePlans',
        perm: 'finance:manage',
      },
    ],
  },
  {
    titleKey: 'nav.section.operations',
    items: [
      {
        href: '/communication',
        labelKey: 'nav.communication',
        icon: 'communication',
        perm: 'announcement:manage',
      },
      {
        href: '/fleet',
        labelKey: 'nav.fleet',
        icon: 'fleet',
        perm: 'bus:read',
        flag: 'bus_tracking',
      },
      {
        href: '/library',
        labelKey: 'nav.library',
        icon: 'library',
        perm: 'library:read',
        flag: 'library_management',
      },
      {
        href: '/inventory',
        labelKey: 'nav.inventory',
        icon: 'inventory',
        perm: 'inventory:read',
        flag: 'inventory_management',
      },
      {
        href: '/clinic',
        labelKey: 'nav.clinic',
        icon: 'clinic',
        perm: 'clinic:read',
        flag: 'school_clinic',
      },
    ],
  },
  {
    titleKey: 'nav.section.reports',
    items: [
      { href: '/reports', labelKey: 'nav.reports', icon: 'reports', perm: 'report:read' },
      {
        href: '/admissions/reports',
        labelKey: 'nav.admissionsReports',
        icon: 'reports',
        perm: 'enrollment:manage',
      },
    ],
  },
  {
    titleKey: 'nav.section.settings',
    items: [
      {
        href: '/settings/organization',
        labelKey: 'nav.organization',
        icon: 'settings',
        perm: 'organization:read',
      },
      {
        href: '/structure/schools',
        labelKey: 'nav.structure',
        icon: 'structure',
        perm: 'school:manage',
      },
      {
        href: '/structure/academic-year',
        labelKey: 'nav.academicYearWorkspace',
        icon: 'academicStructure',
        perm: 'school:manage',
      },
      {
        href: '/structure/academic',
        labelKey: 'nav.academicStructure',
        icon: 'academicStructure',
        perm: 'school:manage',
      },
      { href: '/modules', labelKey: 'nav.modules', icon: 'modules', perm: 'featureflag:manage' },
      {
        href: '/settings/integrations/jofotara',
        labelKey: 'nav.integrations',
        icon: 'integrations',
        perm: 'finance:manage',
      },
      {
        href: '/settings/attendance',
        labelKey: 'nav.attendanceSettings',
        icon: 'settings',
        perm: 'attendance:read',
      },
      { href: '/settings/users', labelKey: 'nav.users', icon: 'users', perm: 'user:manage' },
      { href: '/settings/roles', labelKey: 'nav.roles', icon: 'roles', perm: 'role:manage' },
      {
        href: '/settings/subscription',
        labelKey: 'nav.subscription',
        icon: 'finance',
        perm: 'subscription:read',
      },
    ],
  },
  // Platform plane (Munaxa employees only). Every item is gated by a platform permission, so
  // school users never see this section; the API enforces the same permissions server-side.
  {
    titleKey: 'nav.section.platform',
    items: [
      {
        href: '/platform/console',
        labelKey: 'nav.platformConsole',
        icon: 'dashboard',
        perm: 'platform:dashboard:read',
      },
      {
        href: '/platform/console/schools',
        labelKey: 'nav.platformSchools',
        icon: 'structure',
        perm: 'platform:school:read',
      },
      {
        href: '/platform/console/organizations',
        labelKey: 'nav.platformOrganizations',
        icon: 'structure',
        perm: 'platform:school:read',
      },
      {
        href: '/platform/console/subscriptions',
        labelKey: 'nav.platformSubscriptions',
        icon: 'finance',
        perm: 'platform:subscription:read',
      },
      {
        href: '/platform/console/webhooks',
        labelKey: 'nav.platformWebhooks',
        icon: 'integrations',
        perm: 'platform:featureflag:manage',
      },
      {
        href: '/platform/console/upgrade-requests',
        labelKey: 'nav.platformUpgrades',
        icon: 'reports',
        perm: 'platform:upgrade:review',
      },
      {
        href: '/platform/console/audit',
        labelKey: 'nav.platformAudit',
        icon: 'reports',
        perm: 'platform:audit:read',
      },
      {
        href: '/platform/databases',
        labelKey: 'nav.tenantDatabases',
        icon: 'databases',
        perm: 'platform:tenant:manage',
      },
    ],
  },
];

/**
 * Authenticated application shell: a brand sidebar with permission-filtered navigation and a
 * top bar. On small screens the sidebar collapses behind a hamburger toggle that opens the same
 * navigation as a slide-in drawer. RTL-safe (logical properties). Pages render inside `children`.
 */
export function AppShell({
  principal,
  children,
}: {
  principal: Principal;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const privacy = usePrivacy();
  const [searchOpen, setSearchOpen] = useState(false);
  // Collapsed (icon-rail) vs. expanded sidebar; persisted across sessions.
  const [collapsed, setCollapsed] = useState(false);
  // Enabled feature flags; `null` while loading so flagged items stay hidden until known.
  const [flags, setFlags] = useState<Record<string, boolean> | null>(null);
  // Which audience this hostname serves: 'console' (admin.), 'app' (app.) or 'all' (single domain).
  // Mirrors the host-based middleware so the sidebar shows only the relevant sections per host.
  const [hostMode, setHostMode] = useState<'console' | 'app' | 'all'>('all');
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    const consoleHost = (process.env.NEXT_PUBLIC_CONSOLE_HOST ?? '').toLowerCase();
    const appHost = (process.env.NEXT_PUBLIC_APP_HOST ?? '').toLowerCase();
    if (consoleHost && host === consoleHost) setHostMode('console');
    else if (appHost && host === appHost) setHostMode('app');
    else setHostMode('all');
  }, []);

  useEffect(() => {
    setCollapsed(localStorage.getItem('munaxa.nav.collapsed') === '1');
  }, []);
  /*
   * Persistence stays here. The platform's shell holds the collapsed state but deliberately writes
   * nothing — where a preference lives is an application decision, and a shared package storing it
   * would have to bake a product's key name into code four products share.
   */
  const setCollapsedPersisted = (next: boolean) => {
    localStorage.setItem('munaxa.nav.collapsed', next ? '1' : '0');
    setCollapsed(next);
  };

  // Global search keyboard shortcut: ⌘K / Ctrl-K.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const held = new Set(principal.permissions);
  // Only users who can actually see money get the Privacy Mode control.
  const canFinance = principal.isPlatform || held.has('finance:read');
  // Fail closed: an item is visible only when the user actually holds its permission. Platform
  // accounts are console-only (they hold platform:* permissions, not school ones), so this naturally
  // shows them the Platform section and hides school modules. The API enforces the same permissions
  // server-side, so this just keeps the nav honest.
  const canSee = (i: NavItem) =>
    (!i.perm || held.has(i.perm)) && (!i.flag || flags?.[i.flag] === true);

  // Load feature flags so disabled modules drop out of the navigation entirely.
  useEffect(() => {
    advancedApi
      .flags()
      .then((list) => setFlags(Object.fromEntries(list.map((f) => [f.key, f.enabled]))))
      .catch(() => setFlags({}));
  }, []);

  async function onLogout() {
    await logout();
    clearPrincipalCache();
    router.replace('/login');
  }

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  // `mini` renders the icon-only rail (desktop collapsed); the mobile drawer always passes false.
  // Per-host section visibility: the console host shows only the Platform section; the app host
  // hides it; a single-domain deploy shows everything (permissions still gate individual items).
  const isPlatformGroup = (group: NavGroup) => group.titleKey === 'nav.section.platform';
  const groupsForHost = NAV_GROUPS.filter((group) =>
    hostMode === 'console'
      ? isPlatformGroup(group)
      : hostMode === 'app'
        ? !isPlatformGroup(group)
        : true,
  );

  /*
   * Navigation, fully resolved before it reaches the platform. Host mode, permissions and feature
   * flags are all business rules — the shared shell receives the answers, not the questions.
   */
  const groups: NavigationGroup[] = groupsForHost
    .map((group) => ({
      ...(group.titleKey ? { title: t(group.titleKey) } : {}),
      id: group.titleKey ?? 'root',
      items: group.items.filter(canSee).map((item) => ({
        href: item.href,
        label: t(item.labelKey),
        icon: <NavIcon name={item.icon} />,
        active: isActive(item.href),
      })),
    }))
    .filter((group) => group.items.length > 0);

  // The platform imports no router. Next's typed routes cannot see hrefs coming from the static
  // nav table, so the cast is required by `next build` exactly as it was before.
  const renderLink: RenderNavigationLink = ({ href, children, ...rest }) => (
    <Link href={href as never} {...rest}>
      {children}
    </Link>
  );

  const navLabel = t('shell.mainNavigation');

  const brand = (collapsed: boolean) =>
    collapsed ? (
      <Logo variant="symbol" size={30} priority />
    ) : (
      <Logo variant="horizontal" size={26} priority />
    );

  const sessionFooter = (
    <div
      className="rounded-lg border border-border bg-background/40 p-3 text-xs"
      aria-label={`${principal.roles.join(', ') || '—'} · ${principal.tenantId}`}
    >
      <p className="truncate text-muted-foreground">{principal.roles.join(', ') || '—'}</p>
      <p
        className="truncate font-mono text-[10px] text-muted-foreground/70"
        title={principal.tenantId}
      >
        {principal.tenantId}
      </p>
    </div>
  );

  const backdrop = (
    /* Aurora backdrop — a brand-tinted mesh behind all content (decorative). */
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        background:
          'radial-gradient(1200px 560px at 8% -10%, color-mix(in oklch, var(--accent-cool) 14%, transparent), transparent 60%), radial-gradient(1000px 520px at 100% -8%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 60%)',
      }}
    />
  );

  return (
    <AppShellProvider collapsed={collapsed} onCollapsedChange={setCollapsedPersisted}>
      <PlatformAppShell
        backdrop={backdrop}
        skipLinkLabel={t('shell.skipToContent')}
        sidebar={
          <Sidebar
            brand={brand}
            footer={sessionFooter}
            collapseLabel={t('shell.collapseNav')}
            expandLabel={t('shell.expandNav')}
          >
            <SidebarNav groups={groups} label={navLabel} renderLink={renderLink} />
          </Sidebar>
        }
        drawer={
          <NavigationDrawer
            label={navLabel}
            brand={<Logo variant="horizontal" size={26} priority />}
            footer={sessionFooter}
            closeLabel={t('shell.closeMenu')}
          >
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
                <CurrentYearIndicator />
                <span
                  className="hidden items-center gap-2 rounded-lg border border-border px-3 py-1.5 lg:flex"
                  title={principal.isPlatform ? t('shell.platformPlane') : t('shell.schoolPlane')}
                >
                  <NavIcon name="structure" className="shrink-0 text-muted-foreground" />
                  <span className="max-w-[160px] truncate font-mono text-xs text-muted-foreground">
                    {principal.tenantId}
                  </span>
                </span>
                {canFinance ? (
                  <button
                    type="button"
                    onClick={privacy.toggle}
                    aria-pressed={privacy.enabled}
                    title={privacy.enabled ? t('privacy.reveal') : t('privacy.hide')}
                    className={cn(
                      'hidden h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors sm:flex',
                      privacy.enabled
                        ? 'border-primary/30 bg-primary/10 text-primary-strong'
                        : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {privacy.enabled ? <EyeOffIcon /> : <EyeIcon />}
                    <span className="hidden lg:inline">
                      {privacy.enabled ? t('privacy.on') : t('privacy.off')}
                    </span>
                  </button>
                ) : null}
                <ThemeLocaleToggle />
                <button
                  type="button"
                  aria-label={t('shell.notifications')}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <BellIcon />
                </button>
                <div className="flex items-center gap-2 rounded-lg border border-border py-1 ps-1 pe-2">
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary-strong"
                  >
                    {principal.roles[0]?.[0]?.toUpperCase() ?? 'U'}
                  </span>
                  <span className="hidden leading-tight sm:block">
                    <span className="block text-xs font-medium">
                      {principal.roles[0] ?? t('shell.account')}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {principal.isPlatform ? t('shell.platformPlane') : t('shell.schoolPlane')}
                    </span>
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => void onLogout()}>
                  {t('auth.signOut')}
                </Button>
              </>
            }
          >
            <SidebarTrigger label={t('shell.openMenu')} />
            {/* Search — opens the ⌘K palette; styled as the global search bar. */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={t('search.title')}
              aria-keyshortcuts="Control+K Meta+K"
              className="flex h-9 max-w-xl flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-accent"
            >
              <span aria-hidden="true">⌕</span>
              <span className="flex-1 truncate text-start">{t('search.placeholder')}</span>
              <kbd className="hidden rounded border border-border px-1 font-mono text-[10px] sm:inline">
                ⌘K
              </kbd>
            </button>
          </TopBar>
        }
      >
        <div className="p-6">{children}</div>
      </PlatformAppShell>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} principal={principal} />
    </AppShellProvider>
  );
}

/**
 * Top-bar indicator of the current (ACTIVE) Academic Year — visible across the whole Admin Portal.
 * Falls back to a "Finish setup" link when no year is active. Read-only; never mutates anything.
 */
function CurrentYearIndicator() {
  const { t } = useI18n();
  const [year, setYear] = useState<AcademicYear | null | undefined>(undefined);

  useEffect(() => {
    academicYearsApi
      .current()
      .then(setYear)
      .catch(() => setYear(null));
  }, []);

  if (year === undefined) return null; // still loading — render nothing to avoid a flash

  if (!year) {
    return (
      <Link
        href="/structure/academic-year"
        className="hidden items-center gap-2 rounded-lg border border-accent-warm/40 bg-accent-warm/10 px-3 py-1.5 text-xs font-medium text-accent-warm md:flex"
        title={t('shell.noActiveYear')}
      >
        <span>{t('shell.noActiveYear')}</span>
        <span className="opacity-70">· {t('shell.finishSetup')}</span>
      </Link>
    );
  }

  return (
    <Link
      href="/structure/academic-year"
      className="hidden items-center gap-2 rounded-lg border border-border px-3 py-1.5 md:flex"
      title={t('shell.academicYear')}
    >
      <span className="font-mono text-xs text-muted-foreground">{year.name}</span>
      <Badge tone="success">{t('academicYear.status.ACTIVE')}</Badge>
    </Link>
  );
}

/** Top-bar notifications glyph (decorative; same stroke convention as nav-icons). */
function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9a6 6 0 0 1 12 0c0 5 1.5 6 1.5 6h-15S6 14 6 9M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

/** Privacy Mode "on" glyph — an eye with a slash (figures hidden). */
function EyeOffIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-6.5 10-6.5c1.6 0 3 .4 4.2 1M22 12s-3.5 6.5-10 6.5c-1.6 0-3-.4-4.2-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </svg>
  );
}

/** Privacy Mode "off" glyph — an open eye (figures visible). */
function EyeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

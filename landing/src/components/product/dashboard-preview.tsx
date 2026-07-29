import {
  LayoutDashboard,
  UserPlus,
  Users,
  CalendarCheck,
  GraduationCap,
  Wallet,
  Briefcase,
  Bus,
  MessageSquare,
  BarChart3,
} from '@axa/platform/icons';
import Image from 'next/image';
import { cn } from '@axa/platform';

/**
 * A faithful, static recreation of the Munaxa owner dashboard — the same navigation, KPIs and
 * widgets the product ships with, populated with the demo's "Munaxa Academy" data. Built from
 * design-system tokens so it adapts to the site's light/dark theme. Purely presentational.
 */

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Admissions', icon: UserPlus },
  { label: 'Students', icon: Users },
  { label: 'Attendance', icon: CalendarCheck },
  { label: 'Academics', icon: GraduationCap },
  { label: 'Finance', icon: Wallet },
  { label: 'HR', icon: Briefcase },
  { label: 'Transport', icon: Bus },
  { label: 'Communication', icon: MessageSquare },
  { label: 'Reports', icon: BarChart3 },
];

const KPIS: { label: string; value: string; tone?: 'cool' | 'warm' }[] = [
  { label: 'Students', value: '500' },
  { label: 'Parents', value: '700' },
  { label: 'Teachers', value: '50' },
  { label: 'Attendance', value: '96.4%', tone: 'cool' },
  { label: 'Outstanding', value: 'JOD 38,400', tone: 'warm' },
  { label: 'Collected', value: 'JOD 412,750', tone: 'cool' },
];

const ATTENDANCE = [
  { label: 'Present', value: 463, pct: 92.6, bar: 'bg-accent-cool' },
  { label: 'Late', value: 18, pct: 3.6, bar: 'bg-accent-warm' },
  { label: 'Absent', value: 12, pct: 2.4, bar: 'bg-destructive' },
  { label: 'Excused', value: 7, pct: 1.4, bar: 'bg-primary' },
];

const NOTIFICATIONS: { title: string; body: string; tone: 'cool' | 'warm' | 'muted' }[] = [
  { title: 'Fee reminders sent', body: '214 families notified', tone: 'cool' },
  { title: 'New admission application', body: 'Yousef Haddad · Grade 6', tone: 'warm' },
  { title: 'Term 1 report cards published', body: 'Grades 7–9', tone: 'muted' },
  { title: 'Bus route 4 delayed', body: '~10 min · 28 students', tone: 'warm' },
];

const OUTSTANDING = [
  { name: 'Lina Al-Masri', value: 'JOD 1,850' },
  { name: 'Omar Haddad', value: 'JOD 1,420' },
  { name: 'Salma Khalil', value: 'JOD 1,180' },
  { name: 'Karim Nasser', value: 'JOD 960' },
];

function toneText(tone?: 'cool' | 'warm') {
  if (tone === 'cool') return 'text-accent-cool';
  if (tone === 'warm') return 'text-accent-warm';
  return 'text-foreground';
}

export function DashboardPreview() {
  return (
    <div className="@container flex min-h-[360px] bg-background text-foreground">
      <aside className="hidden w-48 shrink-0 flex-col border-e border-border bg-card/60 p-3 @2xl:flex @5xl:w-52">
        <div className="flex items-center gap-2 px-2 py-2">
          <Image
            src="/app-icon.png"
            alt="Munaxa"
            width={28}
            height={28}
            unoptimized
            className="h-7 w-7 rounded-lg"
          />
          <span className="font-display text-sm font-semibold">Munaxa Academy</span>
        </div>
        <nav className="mt-3 flex flex-col gap-0.5">
          {NAV.map(({ label, icon: Icon, active }) => (
            <span
              key={label}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] transition',
                active ? 'bg-secondary/80 font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </span>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold">Welcome, Sara Mansour</p>
            <p className="truncate text-[11px] text-muted-foreground">
              Owner · Munaxa Academy · 2025–2026 · Term 1
            </p>
          </div>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground @lg:flex">
            Viewing as <span className="font-medium text-foreground">Owner</span>
          </span>
        </div>

        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2 @md:grid-cols-3 @4xl:grid-cols-6">
            {KPIS.map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-border bg-card px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {kpi.label}
                </p>
                <p className={cn('mt-0.5 font-display text-sm font-bold mono', toneText(kpi.tone))}>
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="mb-2 text-xs font-semibold">Attendance today</p>
              <div className="space-y-2">
                {ATTENDANCE.map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{row.label}</span>
                      <span className="mono">{row.value}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn('h-full rounded-full', row.bar)}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 @3xl:col-span-2">
              <p className="mb-2 text-xs font-semibold">Notifications</p>
              <div className="space-y-1.5">
                {NOTIFICATIONS.map((n) => (
                  <div
                    key={n.title}
                    className="flex items-center justify-between gap-3 border-b border-border pb-1.5 text-[11px] last:border-0 last:pb-0"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-foreground">{n.title}</span>{' '}
                      <span className="text-muted-foreground">· {n.body}</span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium',
                        n.tone === 'cool' && 'bg-accent-cool/15 text-accent-cool',
                        n.tone === 'warm' && 'bg-accent-warm/15 text-accent-warm',
                        n.tone === 'muted' && 'bg-secondary text-muted-foreground',
                      )}
                    >
                      {n.tone === 'muted' ? 'read' : 'new'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 text-xs font-semibold">Top outstanding balances</p>
            <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 @2xl:grid-cols-2">
              {OUTSTANDING.map((row) => (
                <div
                  key={row.name}
                  className="flex items-center justify-between gap-3 border-b border-border pb-1.5 text-[11px] last:border-0"
                >
                  <span className="truncate">{row.name}</span>
                  <span className="mono text-accent-warm">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

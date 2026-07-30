'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shell, usePrincipal } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { usePrivacy } from '@/components/privacy-provider';
import { dashboardApi, type DashboardOverview } from '@/lib/dashboard';
import { financeApi, type FinanceDashboard } from '@/lib/finance';
import { NavIcon, type NavIconKey } from '@/components/nav-icons';
import type { Locale } from '@/lib/i18n';
import { Button, Card, CardContent, EmptyState, Skeleton, cn } from '@axa/platform';

type Translate = (k: string) => string;
type Tone = 'primary' | 'cool' | 'warm';

// Chart palette — semantic design tokens (amber/late, blue/excused, grey/absent).
const LATE = 'var(--warning)';
const EXCUSED = 'var(--info)';
const ABSENT = 'var(--muted-foreground)';

export default function Home() {
  return (
    <Shell>
      <Dashboard />
    </Shell>
  );
}

function Dashboard() {
  const principal = usePrincipal();
  const { t, locale } = useI18n();
  const privacy = usePrivacy();

  const held = useMemo(() => new Set(principal.permissions), [principal.permissions]);
  const can = useCallback(
    (perm?: string) => !perm || held.has(perm) || held.has('*') || principal.isPlatform,
    [held, principal.isPlatform],
  );
  const canReport = can('report:read');
  const canFinance = can('finance:read');

  const [data, setData] = useState<DashboardOverview | null>(null);
  const [fin, setFin] = useState<FinanceDashboard | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      setData(await dashboardApi.overview());
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (canReport) void load();
  }, [canReport, load]);

  useEffect(() => {
    if (!canFinance) return;
    financeApi
      .financeDashboard()
      .then(setFin)
      .catch(() => undefined);
  }, [canFinance]);

  // A finance figure is masked only when the user can see finance AND privacy mode hides that scope.
  const masked = useCallback(
    (scope: string) => canFinance && privacy.isMasked(scope),
    [canFinance, privacy],
  );

  const att = data?.attendanceToday;
  const rate =
    att && att.total > 0 ? Math.round(((att.present + att.late) / att.total) * 100) : null;
  const markedRates = (data?.attendanceTrend ?? [])
    .map((d) => d.rate)
    .filter((r): r is number => r !== null);
  const [prevRate, lastRate] = markedRates.slice(-2);
  const attendanceDelta =
    prevRate !== undefined && lastRate !== undefined ? lastRate - prevRate : null;

  const greetingKey = greetingFor(new Date());
  const dateLabel = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  if (!canReport) {
    return (
      <div className="mx-auto w-full max-w-[1600px]">
        <Card>
          <CardContent className="p-8">
            <EmptyState title={t('dashboard.overviewUnavailable')} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t(`dashboard.${greetingKey}`)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dateLabel} · {t('dashboard.welcomeLine')}
          </p>
        </div>
      </div>

      {error && !data ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              title={t('dashboard.overviewUnavailable')}
              action={
                <Button variant="outline" size="sm" onClick={() => void load()}>
                  {t('common.retry')}
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : !data ? (
        <KpiSkeleton />
      ) : (
        <>
          {/* KPI row */}
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi
              icon="students"
              tone="primary"
              label={t('dashboard.totalStudents')}
              value={formatNumber(data.students, locale)}
              delta={{ value: data.deltas.studentsThisMonth, suffix: t('dashboard.fromLastMonth') }}
              spark={data.sparklines.students}
            />
            <Kpi
              icon="attendance"
              tone="cool"
              label={t('dashboard.attendanceToday')}
              value={rate !== null ? `${rate}%` : '—'}
              delta={
                attendanceDelta !== null
                  ? { value: attendanceDelta, suffix: t('dashboard.vsYesterday'), unit: '%' }
                  : undefined
              }
              spark={markedRates}
              sparkTone="cool"
            />
            <Kpi
              icon="enrollment"
              tone="warm"
              label={t('dashboard.newAdmissions')}
              value={formatNumber(data.deltas.studentsThisMonth, locale)}
            />
            <SensitiveKpi
              icon="finance"
              label={t('dashboard.collectedFees')}
              canFinance={canFinance}
              masked={masked('kpi.collected')}
              onReveal={() => privacy.reveal('kpi.collected')}
              value={
                data.finance ? formatMoneyCompact(data.finance.collectedThisMonth, locale) : '—'
              }
              t={t}
            />
            <SensitiveKpi
              icon="reports"
              label={t('dashboard.outstandingBalance')}
              canFinance={canFinance}
              masked={masked('kpi.outstanding')}
              onReveal={() => privacy.reveal('kpi.outstanding')}
              value={data.finance ? formatMoneyCompact(data.finance.outstanding, locale) : '—'}
              t={t}
            />
          </section>

          {/* Attendance + Fee collection */}
          <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <AttendanceWidget
              t={t}
              locale={locale}
              data={data}
              rate={rate}
              delta={attendanceDelta}
            />
            <FeeCollectionCard
              t={t}
              locale={locale}
              finance={data.finance}
              canFinance={canFinance}
              masked={masked('fee-collection')}
              onReveal={() => privacy.reveal('fee-collection')}
            />
          </section>

          {/* Fees at risk + Recent activity */}
          <section className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
            <FeesAtRiskCard
              t={t}
              locale={locale}
              rows={fin?.topOutstanding ?? []}
              canFinance={canFinance}
              masked={masked('fees-at-risk')}
              onReveal={() => privacy.reveal('fees-at-risk')}
            />
            <ActivityCard t={t} locale={locale} activity={data.recentActivity} />
          </section>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI cards
// ---------------------------------------------------------------------------
function Kpi({
  icon,
  label,
  value,
  tone = 'primary',
  delta,
  spark,
  sparkTone = 'primary',
}: {
  icon: NavIconKey;
  label: string;
  value: string;
  tone?: Tone;
  delta?: { value: number; suffix: string; unit?: string } | undefined;
  spark?: number[] | undefined;
  sparkTone?: Tone;
}) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span
            className={cn('flex h-10 w-10 items-center justify-center rounded-xl', chipTone[tone])}
            aria-hidden="true"
          >
            <NavIcon name={icon} />
          </span>
          {spark && spark.length >= 2 ? <Sparkline values={spark} tone={sparkTone} /> : null}
        </div>
        <div>
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="mt-0.5 font-display text-[26px] font-semibold tabular-nums tracking-tight">
            {value}
          </p>
          {delta ? <DeltaChip value={delta.value} suffix={delta.suffix} unit={delta.unit} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** A finance KPI: locked ("Restricted") without finance:read, otherwise masked-until-revealed. */
function SensitiveKpi({
  icon,
  label,
  value,
  canFinance,
  masked,
  onReveal,
  t,
}: {
  icon: NavIconKey;
  label: string;
  value: string;
  canFinance: boolean;
  masked: boolean;
  onReveal: () => void;
  t: Translate;
}) {
  return (
    <Card className={cn('h-full', canFinance ? 'border-warning/30' : 'border-dashed')}>
      <CardContent className="relative flex h-full flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl',
              canFinance ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground',
            )}
            aria-hidden="true"
          >
            <NavIcon name={icon} />
          </span>
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
              canFinance ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground',
            )}
          >
            <LockGlyph />
            {canFinance ? t('privacy.on') : t('privacy.restricted')}
          </span>
        </div>
        <div>
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          {!canFinance ? (
            <>
              <p className="mt-0.5 font-display text-[26px] font-semibold tracking-tight text-muted-foreground/50">
                — — —
              </p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {t('privacy.requiresFinance')}
              </p>
            </>
          ) : masked ? (
            <>
              <p className="mt-0.5 font-mono text-[26px] font-semibold tracking-[0.15em] text-warning/70">
                ••• •••
              </p>
              <button
                type="button"
                onClick={onReveal}
                className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/5 px-2 py-1 text-[11px] font-semibold text-warning transition-colors hover:bg-warning/10"
              >
                <EyeGlyph />
                {t('privacy.revealForSession')}
              </button>
            </>
          ) : (
            <p className="mt-0.5 font-display text-[26px] font-semibold tabular-nums tracking-tight">
              {value}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DeltaChip({
  value,
  suffix,
  unit,
}: {
  value: number;
  suffix: string;
  unit?: string | undefined;
}) {
  const up = value >= 0;
  return (
    <p
      className={cn(
        'mt-1.5 flex items-center gap-1 text-[11px] font-semibold',
        up ? 'text-accent-cool' : 'text-accent-warm',
      )}
    >
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      <span className="tabular-nums">
        {up ? '+' : ''}
        {value}
        {unit ?? ''}
      </span>
      <span className="font-normal text-muted-foreground">{suffix}</span>
    </p>
  );
}

function Sparkline({ values, tone = 'primary' }: { values: number[]; tone?: Tone }) {
  const w = 72;
  const h = 28;
  const pad = 2;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
      const y = h - pad - ((v - min) / range) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true">
      <polyline
        points={points}
        className={strokeTone[tone]}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KpiSkeleton() {
  return (
    <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="h-full">
          <CardContent className="flex h-full flex-col gap-3 p-5">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-6 w-16 rounded" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Attendance widget: live gauge + 7-day trend + composition meter
// ---------------------------------------------------------------------------
function AttendanceWidget({
  t,
  locale,
  data,
  rate,
  delta,
}: {
  t: Translate;
  locale: Locale;
  data: DashboardOverview;
  rate: number | null;
  delta: number | null;
}) {
  const att = data.attendanceToday;
  const presentTotal = att.present + att.late;
  const avg = useMemo(() => {
    const r = data.attendanceTrend.map((d) => d.rate).filter((v): v is number => v !== null);
    return r.length ? Math.round(r.reduce((s, v) => s + v, 0) / r.length) : null;
  }, [data.attendanceTrend]);

  const segments: Array<{ label: string; n: number; color: string }> = [
    { label: t('dashboard.present'), n: att.present, color: 'var(--primary)' },
    { label: t('dashboard.late'), n: att.late, color: LATE },
    { label: t('dashboard.excused'), n: att.excused, color: EXCUSED },
    { label: t('dashboard.absent'), n: att.absent, color: ABSENT },
  ];
  const total = att.total || 1;

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold">
              {t('dashboard.attendanceToday')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('dashboard.thisWeek')}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-cool/10 px-2.5 py-1 text-[11px] font-semibold text-accent-cool">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-cool" aria-hidden="true" />
            {t('dashboard.live')}
          </span>
        </div>

        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <Ring pct={rate ?? 0}>
            <div className="text-center">
              <p className="font-display text-3xl font-semibold leading-none tabular-nums">
                {rate !== null ? `${rate}` : '—'}
                <span className="text-base text-muted-foreground">%</span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t('dashboard.presentToday')}
              </p>
              {delta !== null ? (
                <p
                  className={cn(
                    'mt-1 text-[11px] font-semibold',
                    delta >= 0 ? 'text-accent-cool' : 'text-accent-warm',
                  )}
                >
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% {t('dashboard.vsYesterday')}
                </p>
              ) : null}
              <p className="mt-1 font-mono text-[11px] text-muted-foreground tabular-nums">
                {formatNumber(presentTotal, locale)} / {formatNumber(att.total, locale)}
              </p>
            </div>
          </Ring>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{t('dashboard.attendanceTrend')}</span>
              <span className="flex items-center gap-1.5 font-medium text-accent-cool">
                <span
                  className="inline-block h-0 w-3.5 border-t border-dashed border-accent-cool"
                  aria-hidden="true"
                />
                {t('dashboard.target')} 90%
              </span>
            </div>
            <TrendSpline points={data.attendanceTrend} />
            <div className="mt-1 flex justify-between px-0.5 text-[10px] font-medium text-muted-foreground">
              {data.attendanceTrend.map((d, i) => (
                <span
                  key={d.date}
                  className={
                    i === data.attendanceTrend.length - 1 ? 'font-semibold text-accent-cool' : ''
                  }
                >
                  {shortDay(d.date, locale)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Composition meter */}
        <div className="border-t border-border pt-4">
          <div className="flex h-3 gap-0.5 overflow-hidden">
            {segments.map((s) => (
              <span
                key={s.label}
                className="block rounded-sm first:rounded-s-md last:rounded-e-md"
                style={{ width: `${(s.n / total) * 100}%`, background: s.color }}
                aria-hidden="true"
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1.5">
            {segments.map((s) => (
              <span
                key={s.label}
                className="flex items-center gap-2 text-[11px] text-muted-foreground"
              >
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: s.color }}
                  aria-hidden="true"
                />
                {s.label}{' '}
                <b className="font-mono font-semibold tabular-nums text-foreground">
                  {formatNumber(s.n, locale)}
                </b>
                <span className="text-muted-foreground/70">{Math.round((s.n / total) * 100)}%</span>
              </span>
            ))}
            {avg !== null ? (
              <span className="ms-auto text-[11px] font-semibold text-accent-cool">
                {t('dashboard.averageThisWeek')} {avg}%
              </span>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Circular progress ring (full circle). */
function Ring({
  pct,
  children,
  size = 150,
  thickness = 14,
}: {
  pct: number;
  children: React.ReactNode;
  size?: number;
  thickness?: number;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--accent-cool)" />
            <stop offset="1" stopColor="var(--primary)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          className="stroke-secondary"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          stroke="url(#ring-grad)"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/** Gradient area spline for the 7-day attendance rate, with a 90% target line. */
function TrendSpline({ points }: { points: DashboardOverview['attendanceTrend'] }) {
  const W = 560;
  const H = 120;
  const vals = points.map((p) => p.rate);
  const known = vals.filter((v): v is number => v !== null);
  if (known.length < 2) {
    return (
      <div className="flex h-[120px] items-center justify-center text-xs text-muted-foreground">
        —
      </div>
    );
  }
  const lo = Math.min(80, ...known);
  const hi = 100;
  const y = (v: number) => H - 6 - ((v - lo) / (hi - lo)) * (H - 12);
  // Carry forward the last known value across gaps so the line stays continuous.
  let last = known[0]!;
  const filled = vals.map((v) => (v !== null ? ((last = v), v) : last));
  const xs = filled.map((_, i) => (i / (filled.length - 1)) * W);
  const line = filled.map((v, i) => `${xs[i]!.toFixed(1)},${y(v).toFixed(1)}`).join(' L');
  const targetY = y(90);
  return (
    <div className="h-[120px] w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
      >
        <defs>
          <linearGradient id="att-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0.2" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1="0"
          y1={targetY}
          x2={W}
          y2={targetY}
          stroke="var(--accent-cool)"
          strokeWidth="1.5"
          strokeDasharray="5 5"
          opacity="0.5"
        />
        <path d={`M${line} L${W},${H} L0,${H} Z`} fill="url(#att-fill)" />
        <path
          d={`M${line}`}
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {filled.map((v, i) =>
          i === filled.length - 1 ? (
            <circle
              key={i}
              cx={xs[i]}
              cy={y(v)}
              r="5.5"
              fill="var(--primary)"
              stroke="var(--card)"
              strokeWidth="2.5"
            />
          ) : vals[i] !== null ? (
            <circle
              key={i}
              cx={xs[i]}
              cy={y(v)}
              r="3.5"
              fill="var(--card)"
              stroke="var(--primary)"
              strokeWidth="2.5"
            />
          ) : null,
        )}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fee collection (masked / gated)
// ---------------------------------------------------------------------------
function FeeCollectionCard({
  t,
  locale,
  finance,
  canFinance,
  masked,
  onReveal,
}: {
  t: Translate;
  locale: Locale;
  finance: DashboardOverview['finance'];
  canFinance: boolean;
  masked: boolean;
  onReveal: () => void;
}) {
  const collectedPct = useMemo(() => {
    if (!finance) return null;
    const net = Number(finance.billed) - Number(finance.discounts);
    if (!(net > 0)) return null;
    return Math.round((Number(finance.paid) / net) * 100);
  }, [finance]);

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-display text-base font-semibold">{t('dashboard.feeCollection')}</h2>
            <p className="text-xs text-muted-foreground">{t('dashboard.thisMonth')}</p>
          </div>
        </div>

        {!canFinance ? (
          <LockedPanel t={t} restricted />
        ) : masked ? (
          <LockedPanel t={t} onReveal={onReveal} />
        ) : finance ? (
          <div className="flex flex-1 flex-col justify-center gap-5">
            <div className="flex items-center gap-6">
              <Ring pct={collectedPct ?? 0} size={132} thickness={13}>
                <div className="text-center">
                  <p className="font-display text-xl font-semibold tabular-nums">
                    {collectedPct ?? 0}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {t('dashboard.collectedShort')}
                  </p>
                </div>
              </Ring>
              <ul className="flex-1 space-y-2.5">
                <FinRow
                  color="var(--primary)"
                  label={t('dashboard.paid')}
                  value={formatMoneyCompact(finance.paid, locale)}
                />
                <FinRow
                  color={ABSENT}
                  label={t('dashboard.billed')}
                  value={formatMoneyCompact(finance.billed, locale)}
                />
                <FinRow
                  color={LATE}
                  label={t('dashboard.outstanding')}
                  value={formatMoneyCompact(finance.outstanding, locale)}
                />
                <FinRow
                  color="var(--accent-warm)"
                  label={t('dashboard.overdue')}
                  value={formatMoneyCompact(finance.overdue, locale)}
                  danger
                />
              </ul>
            </div>
          </div>
        ) : (
          <EmptyState
            className="flex-1 justify-center"
            title={t('dashboard.overviewUnavailable')}
          />
        )}
      </CardContent>
    </Card>
  );
}

function FinRow({
  color,
  label,
  value,
  danger,
}: {
  color: string;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-sm"
        style={{ background: color }}
        aria-hidden="true"
      />
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span
        className={cn(
          'font-mono text-[13px] font-semibold tabular-nums',
          danger && 'text-accent-warm',
        )}
      >
        {value}
      </span>
    </li>
  );
}

/** The frosted lock state shown when finance is masked (revealable) or restricted (no access). */
function LockedPanel({
  t,
  onReveal,
  restricted,
}: {
  t: Translate;
  onReveal?: () => void;
  restricted?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
      <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/90 text-background">
        <LockGlyph large />
      </span>
      <h3 className="font-display text-[15px] font-semibold">
        {restricted ? t('privacy.restricted') : t('privacy.hiddenTitle')}
      </h3>
      <p className="max-w-[300px] text-xs leading-relaxed text-muted-foreground">
        {restricted ? t('privacy.requiresFinance') : t('privacy.hiddenBody')}
      </p>
      {!restricted && onReveal ? (
        <Button size="sm" className="mt-2" onClick={onReveal}>
          <EyeGlyph />
          <span className="ms-1.5">{t('privacy.revealForSession')}</span>
        </Button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fees at risk (masked / gated)
// ---------------------------------------------------------------------------
function FeesAtRiskCard({
  t,
  locale,
  rows,
  canFinance,
  masked,
  onReveal,
}: {
  t: Translate;
  locale: Locale;
  rows: FinanceDashboard['topOutstanding'];
  canFinance: boolean;
  masked: boolean;
  onReveal: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-display text-base font-semibold">{t('dashboard.feesAtRisk')}</h2>
            <p className="text-xs text-muted-foreground">{t('dashboard.feesAtRiskSub')}</p>
          </div>
          {canFinance && masked ? (
            <button
              type="button"
              onClick={onReveal}
              className="inline-flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/5 px-2.5 py-1 text-[11px] font-semibold text-warning transition-colors hover:bg-warning/10"
            >
              <EyeGlyph />
              {t('privacy.revealForSession')}
            </button>
          ) : null}
        </div>

        {!canFinance ? (
          <LockedPanel t={t} restricted />
        ) : rows.length === 0 ? (
          <EmptyState className="flex-1 justify-center" title={t('dashboard.allClear')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2.5 text-start text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {t('dashboard.students')}
                  </th>
                  <th className="pb-2.5 text-end text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {t('dashboard.outstanding')}
                  </th>
                  <th className="pb-2.5 text-end text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {t('dashboard.overdue')}
                  </th>
                  <th className="pb-2.5 text-end text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {t('dashboard.status')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 6).map((r) => {
                  const overdue = Number(r.overdue) > 0;
                  return (
                    <tr key={r.studentId} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-semibold text-primary-foreground"
                            style={{ background: 'var(--primary)' }}
                            aria-hidden="true"
                          >
                            {initials(r.studentName)}
                          </span>
                          <span className="truncate text-[13px] font-medium">{r.studentName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-end font-mono text-[13px] font-semibold tabular-nums">
                        {masked ? <Dots /> : formatMoney(r.outstanding, locale)}
                      </td>
                      <td
                        className={cn(
                          'py-2.5 text-end font-mono text-[13px] font-semibold tabular-nums',
                          overdue && 'text-accent-warm',
                        )}
                      >
                        {masked ? <Dots /> : formatMoney(r.overdue, locale)}
                      </td>
                      <td className="py-2.5 text-end">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold',
                            overdue
                              ? 'bg-accent-warm/10 text-accent-warm'
                              : 'bg-accent-cool/10 text-accent-cool',
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              overdue ? 'bg-accent-warm' : 'bg-accent-cool',
                            )}
                            aria-hidden="true"
                          />
                          {overdue ? t('dashboard.overdue') : t('dashboard.current')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Recent activity (audit feed)
// ---------------------------------------------------------------------------
function ActivityCard({
  t,
  locale,
  activity,
}: {
  t: Translate;
  locale: Locale;
  activity: DashboardOverview['recentActivity'];
}) {
  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col p-6">
        <h2 className="mb-4 font-display text-base font-semibold">
          {t('dashboard.recentActivity')}
        </h2>
        {activity.length === 0 ? (
          <EmptyState className="flex-1 justify-center" title={t('dashboard.noRecentActivity')} />
        ) : (
          <ul className="flex flex-col">
            {activity.slice(0, 6).map((a, i) => (
              <li key={i} className="flex gap-3 border-b border-border/60 py-2.5 last:border-0">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                  aria-hidden="true"
                >
                  <NavIcon name="reports" className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px]">
                    <span className="font-semibold">{humanizeAction(a.action)}</span>
                    <span className="text-muted-foreground"> · {a.entityType}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {a.actorName || a.actorUsername || t('dashboard.systemActor')} ·{' '}
                    {relativeTime(a.at, locale)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Small glyphs
// ---------------------------------------------------------------------------
function LockGlyph({ large }: { large?: boolean }) {
  const s = large ? 22 : 11;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EyeGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function Dots() {
  return <span className="tracking-[0.2em] text-muted-foreground/50">••• •••</span>;
}

// ---------------------------------------------------------------------------
// Tones + helpers
// ---------------------------------------------------------------------------
const chipTone: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary-strong',
  cool: 'bg-accent-cool/10 text-accent-cool',
  warm: 'bg-accent-warm/10 text-accent-warm',
};
const strokeTone: Record<Tone, string> = {
  primary: 'stroke-primary-strong',
  cool: 'stroke-accent-cool',
  warm: 'stroke-accent-warm',
};

function greetingFor(d: Date): 'greetingMorning' | 'greetingAfternoon' | 'greetingEvening' {
  const h = d.getHours();
  if (h < 12) return 'greetingMorning';
  if (h < 18) return 'greetingAfternoon';
  return 'greetingEvening';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '—';
}

function humanizeAction(action: string): string {
  return action.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function shortDay(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO' : 'en-US', { weekday: 'short' }).format(
    new Date(iso),
  );
}

function relativeTime(iso: string, locale: Locale): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar-JO' : 'en-US', { numeric: 'auto' });
  if (diffMin < 60) return rtf.format(-diffMin, 'minute');
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return rtf.format(-diffH, 'hour');
  return rtf.format(-Math.round(diffH / 24), 'day');
}

function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-JO' : 'en-US').format(n);
}

function formatMoney(value: string, locale: Locale): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-JO' : 'en-JO', {
    style: 'currency',
    currency: 'JOD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n);
}

function formatMoneyCompact(value: string, locale: Locale): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-JO' : 'en-JO', {
    style: 'currency',
    currency: 'JOD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

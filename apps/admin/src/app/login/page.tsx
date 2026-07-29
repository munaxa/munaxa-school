'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/auth';
import { useI18n } from '@/components/i18n-provider';
import { Logo } from '@/components/logo';
import { Wordmark } from '@/components/wordmark';
import {
  sanitizeIdentifier,
  sanitizePassword,
  sanitizeSchoolCode,
  validateLogin,
  type LoginFieldErrors,
} from '@/lib/login-validation';
import {
  formatCountdown,
  guardStatus,
  recordAttempt,
  recordFailure,
  recordSuccess,
  type GuardStatus,
} from '@/lib/login-guard';

// Typed as a plain string so the cast below is required under Next's typedRoutes (the route
// registry isn't generated during standalone typecheck) — matching the app's href convention.
const forgotPasswordHref = '/forgot-password' as never;

const REMEMBER_KEY = 'munaxa.remember';
const IDENTIFIER_KEY = 'munaxa.identifier';
const SCHOOL_KEY = 'munaxa.school';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [schoolCode, setSchoolCode] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [guard, setGuard] = useState<GuardStatus>({
    locked: false,
    lockRemainingMs: 0,
    rateLimited: false,
    rateRemainingMs: 0,
    remainingAttempts: 5,
  });

  // Restore a remembered school code + identifier, and hydrate the client guard state.
  useEffect(() => {
    try {
      if (localStorage.getItem(REMEMBER_KEY) === '1') {
        setRemember(true);
        setIdentifier(localStorage.getItem(IDENTIFIER_KEY) ?? '');
        setSchoolCode(localStorage.getItem(SCHOOL_KEY) ?? '');
      }
    } catch {
      /* ignore storage access errors */
    }
    setGuard(guardStatus());
  }, []);

  // While locked or rate-limited, tick every second so the countdown updates and the form
  // re-enables the moment the window elapses.
  useEffect(() => {
    if (!guard.locked && !guard.rateLimited) return;
    const id = setInterval(() => setGuard(guardStatus()), 1000);
    return () => clearInterval(id);
  }, [guard.locked, guard.rateLimited]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    // 1) Sanitise, then reflect the cleaned values back into the fields.
    const clean = {
      identifier: sanitizeIdentifier(identifier),
      password: sanitizePassword(password),
      schoolCode: sanitizeSchoolCode(schoolCode),
    };
    setIdentifier(clean.identifier);
    setPassword(clean.password);
    setSchoolCode(clean.schoolCode);

    // 2) Validate. Stop at the first round of client errors.
    const errors = validateLogin(clean);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // 3) Enforce the client guard (lockout + rate limit) before touching the network.
    const current = guardStatus();
    setGuard(current);
    if (current.locked || current.rateLimited) return;
    setGuard(recordAttempt());

    setLoading(true);
    try {
      const result = await login({
        identifier: clean.identifier,
        password: clean.password,
        ...(clean.schoolCode ? { tenantSlug: clean.schoolCode } : {}),
      });
      recordSuccess();
      setGuard(guardStatus());
      try {
        if (remember) {
          localStorage.setItem(REMEMBER_KEY, '1');
          localStorage.setItem(IDENTIFIER_KEY, clean.identifier);
          localStorage.setItem(SCHOOL_KEY, clean.schoolCode);
        } else {
          localStorage.removeItem(REMEMBER_KEY);
          localStorage.removeItem(IDENTIFIER_KEY);
          localStorage.removeItem(SCHOOL_KEY);
        }
      } catch {
        /* ignore storage access errors */
      }
      router.push(result.mustChangePassword ? '/change-password' : '/');
    } catch (err) {
      // A rejected sign-in counts as a failed attempt for the lockout counter.
      setGuard(recordFailure());
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  // The blocking notice (lockout wins over rate limit) shown above the button.
  const blockedMessage = guard.locked
    ? t('auth.lockedBody').replace('{t}', formatCountdown(guard.lockRemainingMs))
    : guard.rateLimited
      ? t('auth.rateLimited').replace('{s}', String(Math.ceil(guard.rateRemainingMs / 1000)))
      : null;

  return (
    <main className="login-aurora relative min-h-screen overflow-hidden bg-background text-foreground lg:h-screen">
      {/* Abstract geometric accents — quiet, enterprise (not cyberpunk). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -end-24 top-10 h-72 w-72 rounded-full border border-border/60 opacity-40"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -start-32 bottom-0 h-96 w-96 rounded-full border border-border/40 opacity-30"
      />

      <ThemeToggle />

      <div className="relative mx-auto flex min-h-screen max-w-[1440px] flex-col px-5 py-6 lg:h-full lg:min-h-0 lg:px-10">
        {/* Brand lockup. */}
        <header className="flex items-center gap-3">
          <Logo variant="stacked" size={56} priority />
        </header>

        <div className="grid flex-1 items-center gap-8 py-6 md:grid-cols-[2fr_3fr] md:gap-12 lg:grid-cols-[45fr_55fr] lg:gap-16">
          <BrandPanel t={t} />
          <SignInCard
            t={t}
            schoolCode={schoolCode}
            setSchoolCode={setSchoolCode}
            identifier={identifier}
            setIdentifier={setIdentifier}
            password={password}
            setPassword={setPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            remember={remember}
            setRemember={setRemember}
            error={error}
            loading={loading}
            fieldErrors={fieldErrors}
            blockedMessage={blockedMessage}
            lockedTitle={guard.locked ? t('auth.lockedTitle') : null}
            blocked={guard.locked || guard.rateLimited}
            attemptsRemaining={
              !guard.locked && guard.remainingAttempts <= 2
                ? t('auth.attemptsRemaining').replace('{n}', String(guard.remainingAttempts))
                : null
            }
            onSubmit={(e) => void onSubmit(e)}
          />
        </div>

        <footer className="space-y-0.5 pb-2 pt-4 text-center text-xs text-muted-foreground">
          <p className="inline-flex items-center justify-center gap-1">
            © {new Date().getFullYear()} <Wordmark /> School OS
          </p>
          <p className="tracking-wide">{t('auth.footerTagline')}</p>
        </footer>
      </div>
    </main>
  );
}

/* ───────────────────────── Sign-in card ───────────────────────── */

interface CardProps {
  t: (k: string) => string;
  schoolCode: string;
  setSchoolCode: (v: string) => void;
  identifier: string;
  setIdentifier: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (f: (v: boolean) => boolean) => void;
  remember: boolean;
  setRemember: (v: boolean) => void;
  error: string | null;
  loading: boolean;
  fieldErrors: LoginFieldErrors;
  blockedMessage: string | null;
  lockedTitle: string | null;
  blocked: boolean;
  attemptsRemaining: string | null;
  onSubmit: (e: React.FormEvent) => void;
}

function SignInCard(p: CardProps) {
  const { t } = p;
  return (
    <div className="mx-auto w-full max-w-[520px]">
      <div className="rounded-3xl border border-border bg-card/70 p-7 shadow-card backdrop-blur-xl sm:p-9 lg:p-10">
        <h1 className="font-display text-3xl font-bold">{t('auth.welcomeBack')}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t('auth.signInContinue')}</p>

        <form onSubmit={p.onSubmit} noValidate className="mt-6 space-y-4">
          <Field
            label={t('auth.schoolCode')}
            error={p.fieldErrors.schoolCode ? t(p.fieldErrors.schoolCode) : undefined}
          >
            {({ id, invalid, describedBy }) => (
              <InputWithIcon icon={<BuildingIcon />} invalid={invalid}>
                <input
                  id={id}
                  type="text"
                  inputMode="text"
                  maxLength={64}
                  value={p.schoolCode}
                  onChange={(e) => p.setSchoolCode(sanitizeSchoolCode(e.target.value))}
                  autoComplete="organization"
                  placeholder={t('auth.schoolCodePlaceholder')}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  className="login-input-field"
                />
              </InputWithIcon>
            )}
          </Field>

          <Field
            label={t('auth.usernameOrEmail')}
            error={p.fieldErrors.identifier ? t(p.fieldErrors.identifier) : undefined}
          >
            {({ id, invalid, describedBy }) => (
              <InputWithIcon icon={<UserIcon />} invalid={invalid}>
                <input
                  id={id}
                  type="text"
                  required
                  maxLength={254}
                  value={p.identifier}
                  onChange={(e) => p.setIdentifier(e.target.value)}
                  autoComplete="username"
                  placeholder={t('auth.usernamePlaceholder')}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  className="login-input-field"
                />
              </InputWithIcon>
            )}
          </Field>

          <Field
            label={t('auth.password')}
            error={p.fieldErrors.password ? t(p.fieldErrors.password) : undefined}
          >
            {({ id, invalid, describedBy }) => (
              <InputWithIcon icon={<LockIcon />} invalid={invalid}>
                <input
                  id={id}
                  type={p.showPassword ? 'text' : 'password'}
                  required
                  maxLength={128}
                  value={p.password}
                  onChange={(e) => p.setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder={t('auth.passwordPlaceholder')}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  className="login-input-field !pe-11"
                />
                <button
                  type="button"
                  onClick={() => p.setShowPassword((v) => !v)}
                  aria-label={p.showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  aria-pressed={p.showPassword}
                  className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {p.showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </InputWithIcon>
            )}
          </Field>

          <div className="flex items-center justify-between text-sm">
            <label className="flex cursor-pointer select-none items-center gap-2 text-muted-foreground">
              <input
                type="checkbox"
                checked={p.remember}
                onChange={(e) => p.setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              {t('auth.rememberMe')}
            </label>
            <Link
              href={forgotPasswordHref}
              className="font-medium text-primary-strong hover:underline"
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>

          {p.blockedMessage ? (
            <div
              className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
              role="alert"
            >
              <span className="mt-0.5 shrink-0">
                <ShieldIcon size={16} />
              </span>
              <div>
                {p.lockedTitle ? <p className="font-semibold">{p.lockedTitle}</p> : null}
                <p className="leading-snug">{p.blockedMessage}</p>
              </div>
            </div>
          ) : p.error ? (
            <p className="text-sm text-destructive" role="alert">
              {p.error}
            </p>
          ) : null}

          {p.attemptsRemaining && !p.blockedMessage ? (
            <p className="text-xs text-accent" role="status">
              {p.attemptsRemaining}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={p.loading || p.blocked}
            className="bg-grad-primary flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display font-semibold text-primary-foreground shadow-glow transition-[filter,transform] hover:brightness-110 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-70"
          >
            {p.loading ? (
              <>
                <Spinner />
                {t('common.loading')}
              </>
            ) : (
              t('auth.signIn')
            )}
          </button>
        </form>

        {/* Security notice. */}
        <div className="mt-5 flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
          <span className="mt-0.5 shrink-0 text-success">
            <ShieldIcon size={16} />
          </span>
          <p>{t('auth.securityNotice')}</p>
        </div>

        {/* In-card technology badges. */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-5">
          <TechBadge
            icon={<InvoiceIcon />}
            title={t('auth.jofotaraConnected')}
            desc={t('auth.jofotaraConnectedDesc')}
          />
          <TechBadge
            icon={<CloudIcon />}
            title={t('auth.cloudService')}
            desc={t('auth.cloudServiceDesc')}
          />
        </div>
      </div>
    </div>
  );
}

function TechBadge({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background/40 px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
        {icon}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="flex items-center gap-1 text-xs font-semibold">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
          {title}
        </p>
        <p className="text-[11px] leading-tight text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

/* ───────────────────────── Brand panel ───────────────────────── */

function BrandPanel({ t }: { t: (k: string) => string }) {
  return (
    <section className="flex flex-col">
      <h2 className="font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
        {t('auth.marketingTitle1')}
        <br />
        <span className="text-primary-strong">{t('auth.marketingTitle2')}</span>
      </h2>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground lg:text-base">
        {t('auth.marketingSubtitle')}
      </p>

      <DashboardPreview t={t} />

      <div className="mt-5 grid grid-cols-2 gap-3">
        <ComplianceBadge
          icon={<ShieldIcon />}
          title="ISO 27001"
          sub={t('auth.badgeInfoSecurity')}
        />
        <ComplianceBadge
          icon={<CheckBadgeIcon />}
          title={t('auth.gdprReady')}
          sub={t('auth.badgeDataProtection')}
        />
        <ComplianceBadge
          icon={<JordanFlag />}
          title={t('auth.jordanCompliance')}
          sub={t('auth.badgeJofotaraReady')}
        />
        <ComplianceBadge
          icon={<CloudIcon />}
          title={t('auth.cloudHosted')}
          sub={t('auth.badgeHighlyAvailable')}
        />
      </div>
    </section>
  );
}

function ComplianceBadge({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card/60 px-3 py-2.5 backdrop-blur">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
        {icon}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-xs font-semibold">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

/** Floating glass analytics panel — Academic, Financial and Operations metrics. */
function DashboardPreview({ t }: { t: (k: string) => string }) {
  void t;
  const academic = [
    { label: 'Total Students', value: '2,480' },
    { label: 'Active Teachers', value: '142' },
    { label: 'Attendance Rate', value: '96.2%' },
    { label: 'Enrollment Growth', value: '+12%', good: true },
  ];
  const ops = [
    { label: 'Transportation', value: 'On Route 18/20', icon: <BusIcon /> },
    { label: 'Daily Attendance', value: '94%', icon: <CheckIcon /> },
    { label: 'Parent Comms', value: '320 sent', icon: <ChatIcon /> },
  ];
  return (
    <div className="relative mt-6 overflow-hidden rounded-2xl border border-border bg-card/70 p-4 shadow-card backdrop-blur-xl">
      <div className="login-glow pointer-events-none absolute -end-12 -top-12 h-48 w-48 opacity-40 blur-2xl" />
      <div className="relative">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
            <p className="text-sm font-semibold">School Overview</p>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">Live • Today</p>
        </div>

        {/* Academic metrics */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {academic.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-background/50 p-2.5">
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <p
                className={`font-mono text-base font-bold leading-tight ${
                  s.good ? 'text-success' : ''
                }`}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Financial + Operations */}
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background/50 p-3">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[11px] font-medium text-muted-foreground">Revenue Trend</p>
              <span className="text-[10px] font-semibold text-success">+18%</span>
            </div>
            <AreaChart />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] text-muted-foreground">Tuition Collection</p>
                <p className="font-mono text-xs font-bold">92%</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Outstanding</p>
                <p className="font-mono text-xs font-bold">$48,200</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/50 p-3">
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Operations</p>
            <ul className="space-y-2">
              {ops.map((o) => (
                <li key={o.label} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary-strong">
                    {o.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
                    {o.label}
                  </span>
                  <span className="font-mono text-[10px] font-semibold">{o.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tiny area chart drawn with the brand violet. */
function AreaChart() {
  const id = useId();
  const pts = [16, 12, 20, 15, 24, 19, 28, 22, 30, 26, 34, 30];
  const w = 240;
  const h = 40;
  const step = w / (pts.length - 1);
  const max = Math.max(...pts) + 6;
  const coords: Array<[number, number]> = pts.map((p, i) => [i * step, h - (p / max) * h]);
  const line = coords
    .map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-10 w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="[stop-color:hsl(var(--primary))]" stopOpacity="0.35" />
          <stop offset="100%" className="[stop-color:hsl(var(--primary))]" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" className="stroke-primary-strong" strokeWidth="1.5" />
    </svg>
  );
}

/* ───────────────────────── Shared inputs ───────────────────────── */

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: (props: {
    id: string;
    invalid: boolean;
    describedBy?: string | undefined;
  }) => React.ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children({ id, invalid: !!error, describedBy: error ? errorId : undefined })}
      {error ? (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function InputWithIcon({
  icon,
  invalid,
  children,
}: {
  icon: React.ReactNode;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative rounded-xl border bg-background/50 transition-colors ${
        invalid
          ? 'border-destructive focus-within:border-destructive focus-within:ring-2 focus-within:ring-destructive/30'
          : 'border-input focus-within:border-primary-strong focus-within:ring-2 focus-within:ring-ring/40'
      }`}
    >
      <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-muted-foreground">
        {icon}
      </span>
      {children}
    </div>
  );
}

/* ───────────────────────── Theme toggle ───────────────────────── */

const THEME_KEY = 'munaxa.theme';
type Theme = 'light' | 'dark';

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem(THEME_KEY) as Theme | null) ?? 'light';
    setTheme(saved);
    document.documentElement.classList.toggle('dark', saved === 'dark');
    setMounted(true);
  }, []);

  function set(next: Theme) {
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  }

  const active = mounted ? theme : 'light';
  return (
    <div className="absolute end-5 top-6 z-10 flex items-center gap-1 rounded-full border border-border bg-card/70 p-1 backdrop-blur lg:end-10">
      <button
        type="button"
        onClick={() => set('light')}
        aria-label="Light theme"
        aria-pressed={active === 'light'}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          active === 'light'
            ? 'bg-primary/15 text-primary-strong'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <SunIcon />
      </button>
      <button
        type="button"
        onClick={() => set('dark')}
        aria-label="Dark theme"
        aria-pressed={active === 'dark'}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          active === 'dark'
            ? 'bg-primary/15 text-primary-strong'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <MoonIcon />
      </button>
    </div>
  );
}

/* ───────────────────────── Icons (currentColor) ───────────────────────── */

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 21h18M5 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16M13 9h5a1 1 0 0 1 1 1v11" />
      <path d="M8 8h2M8 12h2M8 16h2M16 13h0M16 17h0" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.69-8 6v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-3.31-3.58-6-8-6Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17 9V7a5 5 0 0 0-10 0v2a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-7a3 3 0 0 0-3-3Zm-8-2a3 3 0 0 1 6 0v2H9V7Zm4 9.73V18a1 1 0 0 1-2 0v-1.27a2 2 0 1 1 2 0Z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.44M6.6 6.6A13.3 13.3 0 0 0 2 11s3.5 7 10 7a9.1 9.1 0 0 0 5.4-1.6" />
      <path d="m2 2 20 20" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

function ShieldIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CheckBadgeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5l-8-3Z" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.1 9.5 4 4 0 0 0 6.5 19h11Z" />
    </svg>
  );
}

function InvoiceIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 2h9l3 3v15l-2.5-1.5L13 20l-2.5-1.5L8 20l-2-1.2V2Z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}

function BusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 17V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11M4 17h16M4 17v2M20 17v2M4 11h16" />
      <circle cx="8" cy="17" r="1" />
      <circle cx="16" cy="17" r="1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12Z" />
    </svg>
  );
}

/** Simplified Jordanian flag mark — colours via CSS classes keep raw hex out of the JSX. */
function JordanFlag() {
  return (
    <svg width="20" height="14" viewBox="0 0 30 20" aria-hidden="true" className="rounded-[2px]">
      <rect width="30" height="6.67" className="jo-black" />
      <rect y="6.67" width="30" height="6.67" className="jo-white" />
      <rect y="13.33" width="30" height="6.67" className="jo-green" />
      <path d="M0 0 13 10 0 20Z" className="jo-red" />
    </svg>
  );
}

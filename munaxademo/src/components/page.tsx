'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Card, CardContent, cn } from '@axa/platform';
import { useSession } from '@/lib/session-context';

/** Standard page header: title + optional subtitle + right-aligned actions. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** KPI stat card — design-system pattern (mono value, optional accent tone). */
export function Kpi({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: string;
  tone?: 'cool' | 'warm' | 'primary';
  href?: string;
}) {
  const cls =
    tone === 'cool'
      ? 'text-accent-cool'
      : tone === 'warm'
        ? 'text-accent-warm'
        : tone === 'primary'
          ? 'text-primary-strong'
          : '';
  const body = (
    <Card className={href ? 'h-full transition hover:border-primary/40 hover:shadow-glow' : ''}>
      <CardContent className="p-4">
        <div className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className={cn('font-display text-2xl font-semibold', cls)}>{value}</div>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href as never} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Horizontal proportion bar used in attendance / distribution panels. */
export function Bar({
  label,
  n,
  total,
  className,
}: {
  label: string;
  n: number;
  total: number;
  className: string;
}) {
  const pctValue = total > 0 ? Math.round((n / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{n}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className={cn('h-full rounded-full', className)} style={{ width: `${pctValue}%` }} />
      </div>
    </div>
  );
}

/** Gate UI by permission, with a friendly fallback. */
export function Gate({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useSession();
  if (can(perm)) return <>{children}</>;
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">
        Your current role doesn’t have access to this module. Switch role from the top bar to
        explore it.
      </CardContent>
    </Card>
  );
}

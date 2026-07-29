'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  useToast,
} from '@axa/platform';
import { useI18n } from '@/components/i18n-provider';
import { platformApi, type Promotion, type TenantDbStatus } from '@/lib/platform';

const STATUS_TONE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'muted'> = {
  REQUESTED: 'muted',
  PROVISIONED: 'default',
  MIGRATED: 'default',
  DATA_COPIED: 'default',
  VERIFIED: 'warning',
  ACTIVE: 'success',
  FAILED: 'danger',
  ABORTED: 'muted',
};

export default function TenantDatabasesPage() {
  const toast = useToast();
  const { t } = useI18n();
  const [rows, setRows] = useState<Promotion[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ tenantId: '', hostLabel: '', connectionRef: '' });

  const load = useCallback(async () => {
    try {
      setRows(await platformApi.listDatabases());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    try {
      const p = await platformApi.startPromotion({
        tenantId: form.tenantId.trim(),
        ...(form.hostLabel ? { hostLabel: form.hostLabel } : {}),
        ...(form.connectionRef ? { connectionRef: form.connectionRef } : {}),
      });
      toast.success('Promotion started');
      setForm({ tenantId: '', hostLabel: '', connectionRef: '' });
      setSelected(p.tenantId);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start');
    }
  }

  async function advance(tenantId: string, to: TenantDbStatus) {
    try {
      await platformApi.advance(tenantId, to);
      toast.success(`Marked ${to.replace('_', ' ').toLowerCase()}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to advance');
    }
  }

  const current = rows.find((r) => r.tenantId === selected) ?? null;

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-display text-2xl font-semibold">{t('platformDb.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('platformDb.subtitle')}</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>{t('platformDb.startPromotion')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void start(e)} className="flex flex-wrap items-end gap-2">
              <Field label={t('platformDb.tenantId')} className="flex-1">
                <Input
                  value={form.tenantId}
                  onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
                  placeholder="uuid"
                  required
                />
              </Field>
              <Field label={t('platformDb.hostLabel')} className="flex-1">
                <Input
                  value={form.hostLabel}
                  onChange={(e) => setForm({ ...form, hostLabel: e.target.value })}
                  placeholder="school-a / on-prem Amman"
                />
              </Field>
              <Field label={t('platformDb.secretRef')}>
                <Input
                  value={form.connectionRef}
                  onChange={(e) => setForm({ ...form, connectionRef: e.target.value })}
                  placeholder="school_a"
                />
              </Field>
              <Button type="submit">{t('platformDb.start')}</Button>
            </form>
          </CardContent>
        </Card>

        <section className="space-y-2">
          <h2 className="font-display font-medium">{t('platformDb.promotions')}</h2>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {rows.map((r) => (
              <li key={r.tenantId}>
                <button
                  type="button"
                  aria-expanded={r.tenantId === selected}
                  className="flex w-full items-center justify-between gap-3 p-3 text-start"
                  onClick={() => setSelected(r.tenantId === selected ? null : r.tenantId)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{r.hostLabel ?? r.tenantId}</span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">
                      {r.tenantId}
                    </span>
                  </span>
                  <Badge tone={STATUS_TONE[r.status] ?? 'muted'}>{r.status}</Badge>
                </button>
              </li>
            ))}
            {rows.length === 0 ? (
              <li className="p-3 text-sm text-muted-foreground">{t('platformDb.noPromotions')}</li>
            ) : null}
          </ul>
        </section>

        {current ? <Wizard promotion={current} onAdvance={advance} /> : null}
      </div>
    </Shell>
  );
}

function Wizard({
  promotion,
  onAdvance,
}: {
  promotion: Promotion;
  onAdvance: (tenantId: string, to: TenantDbStatus) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const terminal = promotion.status === 'ACTIVE' || promotion.status === 'ABORTED';
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {promotion.hostLabel ?? t('platformDb.promotionFallback')} —{' '}
          {t('platformDb.checklistSuffix')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-2">
          {promotion.steps.map((s) => (
            <li key={s.key} className="flex items-start gap-3">
              <span
                className={[
                  'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px]',
                  s.done
                    ? 'bg-accent-cool/20 text-accent-cool'
                    : s.current
                      ? 'bg-primary/20 text-primary-strong'
                      : 'bg-secondary/60 text-muted-foreground',
                ].join(' ')}
              >
                {s.done ? '✓' : ''}
              </span>
              <span className="min-w-0">
                <span
                  className={[
                    'block text-sm',
                    s.current ? 'font-medium text-foreground' : 'text-muted-foreground',
                  ].join(' ')}
                >
                  {s.key.replace('_', ' ')}
                </span>
                <span className="block text-xs text-muted-foreground">{s.help}</span>
              </span>
            </li>
          ))}
        </ol>

        {promotion.lastError ? (
          <p className="text-sm text-destructive">
            {t('platformDb.lastError')}: {promotion.lastError}
          </p>
        ) : null}

        {!terminal ? (
          <div className="flex flex-wrap gap-2">
            {promotion.nextStep ? (
              <Button onClick={() => void onAdvance(promotion.tenantId, promotion.nextStep!)}>
                {t('platformDb.markPrefix')} {promotion.nextStep.replace('_', ' ').toLowerCase()}{' '}
                {t('platformDb.markSuffix')}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => void onAdvance(promotion.tenantId, 'ABORTED')}>
              {t('platformDb.abort')}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {promotion.status === 'ACTIVE'
              ? t('platformDb.activeNote')
              : t('platformDb.abortedNote')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

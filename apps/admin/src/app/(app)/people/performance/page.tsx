'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { usePrincipal } from '@/components/shell';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  useToast,
} from '@axa/platform';
import { useConfirm } from '@/components/confirm';
import {
  performanceApi,
  PERFORMANCE_CYCLE_STATUSES,
  type PerformanceCycle,
  type PerformanceCycleStatus,
} from '@/lib/people';

const TONE: Record<PerformanceCycleStatus, 'default' | 'success' | 'muted'> = {
  DRAFT: 'muted',
  ACTIVE: 'success',
  CLOSED: 'default',
};

export default function PerformanceCyclesPage() {
  const { t } = useI18n();
  const principal = usePrincipal();
  const canManage = principal.permissions.includes('performance:manage') || principal.isPlatform;
  const toast = useToast();
  const confirm = useConfirm();
  const [cycles, setCycles] = useState<PerformanceCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const EMPTY = { name: '', startDate: '', endDate: '', status: 'DRAFT' as PerformanceCycleStatus };
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCycles(await performanceApi.listCycles());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function save() {
    if (!form.name.trim() || !form.startDate || !form.endDate) return;
    setBusy(true);
    try {
      if (editingId) {
        await performanceApi.updateCycle(editingId, {
          name: form.name.trim(),
          status: form.status,
        });
      } else {
        await performanceApi.createCycle({
          name: form.name.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
          status: form.status,
        });
      }
      toast.success(t('common.saved'));
      reset();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: PerformanceCycle) {
    if (!(await confirm())) return;
    try {
      await performanceApi.removeCycle(c.id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  if (loading) {
    return (
      <Shell>
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold">{t('hr.performanceCycles')}</h1>
          <Link
            href="/people/employees"
            className="text-sm text-muted-foreground hover:text-primary-strong"
          >
            ← {t('nav.hr')}
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('hr.cycles')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {canManage ? (
              <div className="flex flex-wrap items-end gap-2">
                <Field label={t('common.name')} className="flex-1 min-w-40">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="2026 Annual"
                  />
                </Field>
                {!editingId ? (
                  <>
                    <Field label={t('hr.startDate')}>
                      <Input
                        type="date"
                        dir="ltr"
                        value={form.startDate}
                        onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      />
                    </Field>
                    <Field label={t('hr.endDate')}>
                      <Input
                        type="date"
                        dir="ltr"
                        value={form.endDate}
                        onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      />
                    </Field>
                  </>
                ) : null}
                <Field label={t('common.status')}>
                  <Select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as PerformanceCycleStatus })
                    }
                  >
                    {PERFORMANCE_CYCLE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`hr.cycleStatus.${s}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
                {editingId ? (
                  <Button size="sm" variant="outline" onClick={reset} disabled={busy}>
                    {t('common.cancel')}
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => void save()} disabled={busy || !form.name.trim()}>
                  {editingId ? t('common.save') : t('common.add')}
                </Button>
              </div>
            ) : null}

            {cycles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('hr.noCycles')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {cycles.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{c.name}</span>
                      <Badge tone={TONE[c.status]} className="ms-2">
                        {t(`hr.cycleStatus.${c.status}`)}
                      </Badge>
                      <span className="ms-2 text-xs text-muted-foreground">
                        {c.startDate.slice(0, 10)} → {c.endDate.slice(0, 10)}
                      </span>
                    </div>
                    {canManage ? (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingId(c.id);
                            setForm({
                              name: c.name,
                              startDate: c.startDate.slice(0, 10),
                              endDate: c.endDate.slice(0, 10),
                              status: c.status,
                            });
                          }}
                        >
                          {t('common.edit')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => void remove(c)}
                        >
                          {t('common.delete')}
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

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
  PageHeader,
  useToast,
} from '@axa/platform';
import { useConfirm } from '@/components/confirm';
import { trainingApi, type TrainingCourse, type TrainingRecord } from '@/lib/people';

export default function TrainingCatalogPage() {
  const { t } = useI18n();
  const principal = usePrincipal();
  const canManage = principal.permissions.includes('training:manage') || principal.isPlatform;
  const toast = useToast();
  const confirm = useConfirm();
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [expiring, setExpiring] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const EMPTY = { title: '', category: '', provider: '', hours: '', mandatory: false };
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [crs, exp] = await Promise.all([
        trainingApi.listCourses(),
        trainingApi.expiring(90).catch(() => [] as TrainingRecord[]),
      ]);
      setCourses(crs);
      setExpiring(exp);
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
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      const data = {
        title: form.title.trim(),
        mandatory: form.mandatory,
        ...(form.category ? { category: form.category } : {}),
        ...(form.provider ? { provider: form.provider } : {}),
        ...(form.hours ? { hours: Number(form.hours) } : {}),
      };
      if (editingId) await trainingApi.updateCourse(editingId, data);
      else await trainingApi.createCourse(data);
      toast.success(t('common.saved'));
      reset();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: TrainingCourse) {
    if (!(await confirm())) return;
    try {
      await trainingApi.removeCourse(c.id);
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
        <PageHeader
          title={t('hr.training')}
          align="center"
          actions={
            <Link
              href="/people/employees"
              className="text-sm text-muted-foreground hover:text-primary-strong"
            >
              ← {t('nav.hr')}
            </Link>
          }
        />

        {expiring.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('hr.expiringCertifications')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {expiring.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {r.employee.firstNameEn} {r.employee.lastNameEn}
                      <span className="text-muted-foreground"> · {r.course.title}</span>
                    </span>
                    <Badge tone="warning">{r.expiresAt ? r.expiresAt.slice(0, 10) : ''}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('hr.courseCatalog')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {canManage ? (
              <div className="flex flex-wrap items-end gap-2">
                <Field label={t('common.title')} className="flex-1 min-w-40">
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </Field>
                <Field label={t('hr.category')}>
                  <Input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </Field>
                <Field label={t('hr.hours')}>
                  <Input
                    type="number"
                    dir="ltr"
                    min={0}
                    className="w-20"
                    value={form.hours}
                    onChange={(e) => setForm({ ...form, hours: e.target.value })}
                  />
                </Field>
                <label className="flex items-center gap-1 pb-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={form.mandatory}
                    onChange={(e) => setForm({ ...form, mandatory: e.target.checked })}
                  />
                  {t('hr.mandatory')}
                </label>
                {editingId ? (
                  <Button size="sm" variant="outline" onClick={reset} disabled={busy}>
                    {t('common.cancel')}
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => void save()} disabled={busy || !form.title.trim()}>
                  {editingId ? t('common.save') : t('common.add')}
                </Button>
              </div>
            ) : null}

            {courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('hr.noCourses')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {courses.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{c.title}</span>
                      {c.mandatory ? (
                        <Badge tone="warning" className="ms-2">
                          {t('hr.mandatory')}
                        </Badge>
                      ) : null}
                      {!c.isActive ? (
                        <Badge tone="muted" className="ms-2">
                          {t('hr.inactive')}
                        </Badge>
                      ) : null}
                      <span className="ms-2 text-xs text-muted-foreground">
                        {c.category ? `${c.category} · ` : ''}
                        {c.hours != null ? `${Number(c.hours)} ${t('hr.hours')}` : ''}
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
                              title: c.title,
                              category: c.category ?? '',
                              provider: c.provider ?? '',
                              hours: c.hours != null ? String(Number(c.hours)) : '',
                              mandatory: c.mandatory,
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

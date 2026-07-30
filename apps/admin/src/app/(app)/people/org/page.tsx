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
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@axa/platform';
import { useConfirm } from '@/components/confirm';
import { departmentsApi, positionsApi, type Department, type Position } from '@/lib/people';

export default function OrganizationPage() {
  const { t } = useI18n();
  const principal = usePrincipal();
  const canManage = principal.permissions.includes('hr:org:manage') || principal.isPlatform;

  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [deps, pos] = await Promise.all([departmentsApi.list(), positionsApi.list()]);
      setDepartments(deps);
      setPositions(pos);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load organisation');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Shell>
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title={t('hr.organization')}
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
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DepartmentsCard departments={departments} canManage={canManage} onChanged={load} />
        <PositionsCard
          positions={positions}
          departments={departments}
          canManage={canManage}
          onChanged={load}
        />
      </div>
    </Shell>
  );
}

function DepartmentsCard({
  departments,
  canManage,
  onChanged,
}: {
  departments: Department[];
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const EMPTY = { name: '', code: '', parentId: '' };
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
  }
  function startEdit(d: Department) {
    setEditingId(d.id);
    setForm({ name: d.name, code: d.code ?? '', parentId: d.parentId ?? '' });
  }

  async function save() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const data = {
        name: form.name.trim(),
        ...(form.code.trim() ? { code: form.code.trim() } : {}),
        ...(form.parentId ? { parentId: form.parentId } : {}),
      };
      if (editingId) await departmentsApi.update(editingId, data);
      else await departmentsApi.create(data);
      toast.success(editingId ? t('hr.deptUpdated') : t('hr.deptCreated'));
      reset();
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(d: Department) {
    if (!(await confirm())) return;
    try {
      await departmentsApi.remove(d.id);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('hr.departments')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage ? (
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t('common.name')} className="flex-1 min-w-40">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Science"
              />
            </Field>
            <Field label={t('hr.code')}>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="SCI"
              />
            </Field>
            <Field label={t('hr.parentDept')} className="min-w-40">
              <Select
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
              >
                <option value="">{t('hr.none')}</option>
                {departments
                  .filter((d) => d.id !== editingId)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
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
        {departments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('hr.noDepartments')}</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t('common.name')}</TH>
                <TH>{t('hr.parentDept')}</TH>
                <TH className="text-end">{t('hr.headcount')}</TH>
                {canManage ? <TH className="text-end">{t('common.actions')}</TH> : null}
              </TR>
            </THead>
            <TBody>
              {departments.map((d) => (
                <TR key={d.id} className={d.isActive ? undefined : 'opacity-60'}>
                  <TD>
                    <span className="font-medium">{d.name}</span>
                    {d.code ? (
                      <span className="ms-2 font-mono text-xs text-muted-foreground">{d.code}</span>
                    ) : null}
                  </TD>
                  <TD className="text-sm text-muted-foreground">{d.parent?.name ?? '—'}</TD>
                  <TD className="text-end font-mono text-xs">
                    <Badge tone="muted">{d.headcount ?? 0}</Badge>
                  </TD>
                  {canManage ? (
                    <TD className="text-end">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(d)}>
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => void remove(d)}
                      >
                        {t('common.delete')}
                      </Button>
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function PositionsCard({
  positions,
  departments,
  canManage,
  onChanged,
}: {
  positions: Position[];
  departments: Department[];
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const EMPTY = { title: '', code: '', departmentId: '', budgetedHeadcount: '' };
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
  }
  function startEdit(p: Position) {
    setEditingId(p.id);
    setForm({
      title: p.title,
      code: p.code ?? '',
      departmentId: p.departmentId ?? '',
      budgetedHeadcount: p.budgetedHeadcount != null ? String(p.budgetedHeadcount) : '',
    });
  }

  async function save() {
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      const data = {
        title: form.title.trim(),
        ...(form.code.trim() ? { code: form.code.trim() } : {}),
        ...(form.departmentId ? { departmentId: form.departmentId } : {}),
        ...(form.budgetedHeadcount ? { budgetedHeadcount: Number(form.budgetedHeadcount) } : {}),
      };
      if (editingId) await positionsApi.update(editingId, data);
      else await positionsApi.create(data);
      toast.success(editingId ? t('hr.posUpdated') : t('hr.posCreated'));
      reset();
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Position) {
    if (!(await confirm())) return;
    try {
      await positionsApi.remove(p.id);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('hr.positions')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage ? (
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t('hr.title')} className="flex-1 min-w-40">
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Senior Teacher"
              />
            </Field>
            <Field label={t('hr.code')}>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </Field>
            <Field label={t('people.department')} className="min-w-40">
              <Select
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              >
                <option value="">{t('hr.none')}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('hr.budgeted')}>
              <Input
                type="number"
                dir="ltr"
                min={0}
                value={form.budgetedHeadcount}
                onChange={(e) => setForm({ ...form, budgetedHeadcount: e.target.value })}
              />
            </Field>
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
        {positions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('hr.noPositions')}</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t('hr.title')}</TH>
                <TH>{t('people.department')}</TH>
                <TH className="text-end">{t('hr.filled')}</TH>
                <TH className="text-end">{t('hr.budgeted')}</TH>
                <TH className="text-end">{t('hr.vacancies')}</TH>
                {canManage ? <TH className="text-end">{t('common.actions')}</TH> : null}
              </TR>
            </THead>
            <TBody>
              {positions.map((p) => (
                <TR key={p.id} className={p.isActive ? undefined : 'opacity-60'}>
                  <TD>
                    <span className="font-medium">{p.title}</span>
                    {p.code ? (
                      <span className="ms-2 font-mono text-xs text-muted-foreground">{p.code}</span>
                    ) : null}
                  </TD>
                  <TD className="text-sm text-muted-foreground">{p.department?.name ?? '—'}</TD>
                  <TD className="text-end font-mono text-xs">{p.filled ?? 0}</TD>
                  <TD className="text-end font-mono text-xs">{p.budgetedHeadcount ?? '—'}</TD>
                  <TD className="text-end font-mono text-xs">
                    {p.vacancies != null ? (
                      <Badge tone={p.vacancies > 0 ? 'warning' : 'muted'}>{p.vacancies}</Badge>
                    ) : (
                      '—'
                    )}
                  </TD>
                  {canManage ? (
                    <TD className="text-end">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(p)}>
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => void remove(p)}
                      >
                        {t('common.delete')}
                      </Button>
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

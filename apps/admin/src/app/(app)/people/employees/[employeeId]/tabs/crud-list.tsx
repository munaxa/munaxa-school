'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import {
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

export interface FieldSpec {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'number' | 'email' | 'select' | 'checkbox';
  options?: { value: string; label: string }[];
  required?: boolean;
  rtl?: boolean;
}

export interface ColumnSpec<T> {
  label: string;
  render: (row: T) => React.ReactNode;
}

export interface CrudApi<T> {
  list: (employeeId: string) => Promise<T[]>;
  create: (employeeId: string, data: Record<string, unknown>) => Promise<T>;
  update: (employeeId: string, id: string, data: Record<string, unknown>) => Promise<T>;
  remove: (employeeId: string, id: string) => Promise<void>;
}

/**
 * Generic employee sub-record list with an inline add/edit form — the single UI implementation
 * behind emergency contacts, dependents, education, certificates and bank accounts (Phase 2).
 */
export function CrudList<T extends { id: string }>({
  title,
  employeeId,
  api,
  fields,
  columns,
  canManage,
  toForm,
}: {
  title: string;
  employeeId: string;
  api: CrudApi<T>;
  fields: FieldSpec[];
  columns: ColumnSpec<T>[];
  canManage: boolean;
  /** Map a row back into the editable form values. */
  toForm: (row: T) => Record<string, string | boolean>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const empty = useCallback(
    () =>
      Object.fromEntries(fields.map((f) => [f.key, f.type === 'checkbox' ? false : ''])) as Record<
        string,
        string | boolean
      >,
    [fields],
  );
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string | boolean>>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api.list(employeeId));
    } catch {
      /* surfaced by parent error boundary; keep the tab usable */
    } finally {
      setLoading(false);
    }
  }, [api, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  function reset() {
    setEditingId(null);
    setForm(empty());
  }
  function startEdit(row: T) {
    setEditingId(row.id);
    setForm({ ...empty(), ...toForm(row) });
  }

  function payload(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const v = form[f.key];
      if (f.type === 'checkbox') out[f.key] = Boolean(v);
      else if (typeof v === 'string' && v.trim() !== '')
        out[f.key] = f.type === 'number' ? Number(v) : v.trim();
    }
    return out;
  }

  async function save() {
    setBusy(true);
    try {
      if (editingId) await api.update(employeeId, editingId, payload());
      else await api.create(employeeId, payload());
      toast.success(t('common.saved'));
      reset();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: T) {
    if (!(await confirm())) return;
    try {
      await api.remove(employeeId, row.id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const requiredMissing = fields.some((f) => f.required && !String(form[f.key] ?? '').trim());

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map((f) => (
              <Field key={f.key} label={f.label}>
                {f.type === 'select' ? (
                  <Select
                    value={String(form[f.key] ?? '')}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  >
                    <option value="">—</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : f.type === 'checkbox' ? (
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={Boolean(form[f.key])}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.checked }))}
                  />
                ) : (
                  <Input
                    type={
                      f.type === 'date'
                        ? 'date'
                        : f.type === 'number'
                          ? 'number'
                          : f.type === 'email'
                            ? 'email'
                            : 'text'
                    }
                    dir={
                      f.rtl ? 'rtl' : f.type === 'date' || f.type === 'number' ? 'ltr' : undefined
                    }
                    value={String(form[f.key] ?? '')}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                )}
              </Field>
            ))}
            <div className="col-span-full flex justify-end gap-2">
              {editingId ? (
                <Button variant="outline" size="sm" onClick={reset} disabled={busy}>
                  {t('common.cancel')}
                </Button>
              ) : null}
              <Button size="sm" onClick={() => void save()} disabled={busy || requiredMissing}>
                {editingId ? t('common.save') : t('common.add')}
              </Button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('hr.noRecords')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0 text-sm">
                  {columns.map((c, i) => (
                    <span key={i} className={i === 0 ? 'font-medium' : 'text-muted-foreground'}>
                      {i > 0 ? ' · ' : ''}
                      {c.render(row)}
                    </span>
                  ))}
                </div>
                {canManage ? (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(row)}>
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => void remove(row)}
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
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
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
  Textarea,
  useToast,
} from '@axa/platform';
import { useConfirm } from '@/components/confirm';
import {
  contractsApi,
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  type Contract,
  type ContractInput,
  type ContractStatus,
} from '@/lib/people';

const STATUS_TONE: Record<ContractStatus, 'default' | 'success' | 'warning' | 'muted' | 'danger'> =
  {
    DRAFT: 'default',
    ACTIVE: 'success',
    EXPIRED: 'warning',
    TERMINATED: 'danger',
    RENEWED: 'muted',
  };

type Mode =
  | { kind: 'create' }
  | { kind: 'edit'; contract: Contract }
  | { kind: 'renew'; contract: Contract };

export function ContractsTab({
  employeeId,
  canManage,
}: {
  employeeId: string;
  canManage: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode | null>(null);

  const load = useCallback(async () => {
    try {
      setContracts(await contractsApi.list(employeeId));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(c: Contract) {
    if (!(await confirm())) return;
    try {
      await contractsApi.remove(employeeId, c.id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('hr.contracts')}</CardTitle>
        {canManage ? (
          <Button size="sm" onClick={() => setMode({ kind: 'create' })}>
            {t('hr.addContract')}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('hr.noContracts')}</p>
        ) : (
          <ul className="space-y-2">
            {contracts.map((c) => (
              <li key={c.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-medium">{t(`hr.contractType.${c.contractType}`)}</span>
                    {c.title ? <span className="text-muted-foreground"> · {c.title}</span> : null}
                    <span className="ms-2">
                      <Badge tone={STATUS_TONE[c.status]}>
                        {t(`hr.contractStatus.${c.status}`)}
                      </Badge>
                    </span>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMode({ kind: 'edit', contract: c })}
                      >
                        {t('common.edit')}
                      </Button>
                      {c.status !== 'RENEWED' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMode({ kind: 'renew', contract: c })}
                        >
                          {t('hr.renew')}
                        </Button>
                      ) : null}
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
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  <span>
                    {c.startDate.slice(0, 10)}
                    {c.endDate ? ` → ${c.endDate.slice(0, 10)}` : ` → ${t('hr.openEnded')}`}
                  </span>
                  {c.baseSalary != null ? (
                    <span>
                      {t('hr.baseSalary')}: {c.baseSalary} {c.currency ?? ''}
                    </span>
                  ) : null}
                  {c.vacationDays != null ? (
                    <span>
                      {t('hr.vacationDays')}: {c.vacationDays}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {mode ? (
        <ContractEditor
          employeeId={employeeId}
          mode={mode}
          onClose={() => setMode(null)}
          onSaved={() => {
            setMode(null);
            void load();
          }}
        />
      ) : null}
    </Card>
  );
}

function ContractEditor({
  employeeId,
  mode,
  onClose,
  onSaved,
}: {
  employeeId: string;
  mode: Mode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const source = mode.kind === 'create' ? undefined : mode.contract;
  const [form, setForm] = useState({
    contractType: source?.contractType ?? 'PERMANENT',
    title: source?.title ?? '',
    startDate: (source?.startDate ?? '').slice(0, 10),
    endDate: (source?.endDate ?? '').slice(0, 10),
    baseSalary: source?.baseSalary != null ? String(source.baseSalary) : '',
    currency: source?.currency ?? 'JOD',
    workingHours: source?.workingHours != null ? String(source.workingHours) : '',
    vacationDays: source?.vacationDays != null ? String(source.vacationDays) : '',
    benefits: source?.benefits ?? '',
    notes: source?.notes ?? '',
    status: source?.status ?? 'DRAFT',
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  function payload(): ContractInput {
    const p: ContractInput = {
      contractType: form.contractType,
      startDate: form.startDate,
    };
    if (form.title.trim()) p.title = form.title.trim();
    if (form.endDate) p.endDate = form.endDate;
    if (form.baseSalary) p.baseSalary = Number(form.baseSalary);
    if (form.currency.trim()) p.currency = form.currency.trim();
    if (form.workingHours) p.workingHours = Number(form.workingHours);
    if (form.vacationDays) p.vacationDays = Number(form.vacationDays);
    if (form.benefits.trim()) p.benefits = form.benefits.trim();
    if (form.notes.trim()) p.notes = form.notes.trim();
    return p;
  }

  async function save() {
    if (!form.startDate) return;
    setBusy(true);
    try {
      if (mode.kind === 'create') await contractsApi.create(employeeId, payload());
      else if (mode.kind === 'renew')
        await contractsApi.renew(employeeId, mode.contract.id, payload());
      else
        await contractsApi.update(employeeId, mode.contract.id, {
          ...payload(),
          status: form.status,
        });
      toast.success(t('common.saved'));
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const heading =
    mode.kind === 'create'
      ? t('hr.addContract')
      : mode.kind === 'renew'
        ? t('hr.renewContract')
        : t('hr.editContract');

  return (
    <div className="fixed inset-0 z-modal flex items-start justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative my-8 w-full max-w-xl rounded-xl border border-border bg-card p-5 shadow-card"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{heading}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('common.cancel')}>
            ✕
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('hr.contractTypeLabel')}>
            <Select
              value={form.contractType}
              onChange={(e) => set({ contractType: e.target.value as typeof form.contractType })}
            >
              {CONTRACT_TYPES.map((c) => (
                <option key={c} value={c}>
                  {t(`hr.contractType.${c}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('hr.contractTitle')}>
            <Input value={form.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label={t('hr.startDate')}>
            <Input
              type="date"
              dir="ltr"
              value={form.startDate}
              onChange={(e) => set({ startDate: e.target.value })}
            />
          </Field>
          <Field label={t('hr.endDate')}>
            <Input
              type="date"
              dir="ltr"
              value={form.endDate}
              onChange={(e) => set({ endDate: e.target.value })}
            />
          </Field>
          <Field label={t('hr.baseSalary')}>
            <Input
              type="number"
              dir="ltr"
              min={0}
              step="0.001"
              value={form.baseSalary}
              onChange={(e) => set({ baseSalary: e.target.value })}
            />
          </Field>
          <Field label={t('hr.currency')}>
            <Input value={form.currency} onChange={(e) => set({ currency: e.target.value })} />
          </Field>
          <Field label={t('hr.workingHours')}>
            <Input
              type="number"
              dir="ltr"
              min={0}
              value={form.workingHours}
              onChange={(e) => set({ workingHours: e.target.value })}
            />
          </Field>
          <Field label={t('hr.vacationDays')}>
            <Input
              type="number"
              dir="ltr"
              min={0}
              value={form.vacationDays}
              onChange={(e) => set({ vacationDays: e.target.value })}
            />
          </Field>
          {mode.kind === 'edit' ? (
            <Field label={t('common.status')}>
              <Select
                value={form.status}
                onChange={(e) => set({ status: e.target.value as typeof form.status })}
              >
                {CONTRACT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`hr.contractStatus.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label={t('hr.benefits')} className="sm:col-span-2">
            <Textarea
              rows={2}
              value={form.benefits}
              onChange={(e) => set({ benefits: e.target.value })}
            />
          </Field>
          <Field label={t('common.reason')} className="sm:col-span-2">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()} disabled={busy || !form.startDate}>
            {busy ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}

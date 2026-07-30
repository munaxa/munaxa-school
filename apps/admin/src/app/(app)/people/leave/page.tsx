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
import { leaveApi, type LeaveRequest, type LeaveType } from '@/lib/people';

export default function LeaveManagementPage() {
  const { t } = useI18n();
  const principal = usePrincipal();
  const canManage = principal.permissions.includes('staff-leave:manage') || principal.isPlatform;
  const canApprove = principal.permissions.includes('staff-leave:approve') || principal.isPlatform;

  const [types, setTypes] = useState<LeaveType[]>([]);
  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [tys, reqs] = await Promise.all([
        leaveApi.listTypes(),
        leaveApi.listRequests({ status: 'PENDING' }).catch(() => [] as LeaveRequest[]),
      ]);
      setTypes(tys);
      setPending(reqs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leave');
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
          title={t('hr.leaveManagement')}
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

        {canApprove ? <ApprovalQueue pending={pending} onChanged={load} /> : null}
        <LeaveTypesCard types={types} canManage={canManage} onChanged={load} />
      </div>
    </Shell>
  );
}

function ApprovalQueue({
  pending,
  onChanged,
}: {
  pending: LeaveRequest[];
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();

  async function decide(id: string, action: 'approve' | 'reject') {
    try {
      if (action === 'approve') await leaveApi.approve(id);
      else await leaveApi.reject(id);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('hr.pendingApprovals')}</CardTitle>
      </CardHeader>
      <CardContent>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('hr.noPendingLeave')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <span className="font-medium">
                    {r.employee.firstNameEn} {r.employee.lastNameEn}
                  </span>
                  <span className="text-muted-foreground"> · {r.leaveType.name}</span>
                  {r.requiredLevels > 1 ? (
                    <span className="ms-1 text-xs text-muted-foreground">
                      {t('hr.level')} {r.currentLevel}/{r.requiredLevels}
                    </span>
                  ) : null}
                  <span className="block text-xs text-muted-foreground">
                    {r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)} · {Number(r.workingDays)}{' '}
                    {t('hr.days')}
                    {r.reason ? ` · ${r.reason}` : ''}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => void decide(r.id, 'approve')}>
                    {t('hr.approve')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => void decide(r.id, 'reject')}
                  >
                    {t('hr.reject')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LeaveTypesCard({
  types,
  canManage,
  onChanged,
}: {
  types: LeaveType[];
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const EMPTY = { name: '', defaultAnnualDays: '', approvalLevels: '1', paid: true };
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
  }
  function startEdit(ty: LeaveType) {
    setEditingId(ty.id);
    setForm({
      name: ty.name,
      defaultAnnualDays: ty.defaultAnnualDays != null ? String(ty.defaultAnnualDays) : '',
      approvalLevels: String(ty.approvalLevels),
      paid: ty.paid,
    });
  }

  async function save() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const data = {
        name: form.name.trim(),
        paid: form.paid,
        approvalLevels: Number(form.approvalLevels) || 1,
        ...(form.defaultAnnualDays ? { defaultAnnualDays: Number(form.defaultAnnualDays) } : {}),
      };
      if (editingId) await leaveApi.updateType(editingId, data);
      else await leaveApi.createType(data);
      toast.success(t('common.saved'));
      reset();
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(ty: LeaveType) {
    if (!(await confirm())) return;
    try {
      await leaveApi.removeType(ty.id);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('hr.leaveTypes')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage ? (
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t('common.name')} className="flex-1 min-w-40">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Annual"
              />
            </Field>
            <Field label={t('hr.defaultDays')}>
              <Input
                type="number"
                dir="ltr"
                min={0}
                value={form.defaultAnnualDays}
                onChange={(e) => setForm({ ...form, defaultAnnualDays: e.target.value })}
              />
            </Field>
            <Field label={t('hr.approvalLevels')}>
              <Input
                type="number"
                dir="ltr"
                min={1}
                max={5}
                value={form.approvalLevels}
                onChange={(e) => setForm({ ...form, approvalLevels: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-1 pb-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.paid}
                onChange={(e) => setForm({ ...form, paid: e.target.checked })}
              />
              {t('hr.paid')}
            </label>
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
        {types.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('hr.noLeaveTypes')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {types.map((ty) => (
              <li key={ty.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{ty.name}</span>
                  <Badge tone={ty.paid ? 'success' : 'muted'} className="ms-2">
                    {ty.paid ? t('hr.paid') : t('hr.unpaid')}
                  </Badge>
                  <span className="ms-2 text-xs text-muted-foreground">
                    {ty.defaultAnnualDays != null
                      ? `${ty.defaultAnnualDays} ${t('hr.days')} · `
                      : ''}
                    {ty.approvalLevels} {t('hr.approvalLevels')}
                  </span>
                </div>
                {canManage ? (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(ty)}>
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => void remove(ty)}
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

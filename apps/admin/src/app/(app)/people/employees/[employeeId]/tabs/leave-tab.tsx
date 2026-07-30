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
  DatePicker,
  Field,
  Input,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@axa/platform';
import { useConfirm } from '@/components/confirm';
import {
  leaveApi,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type StaffLeaveStatus,
} from '@/lib/people';

const STATUS_TONE: Record<
  StaffLeaveStatus,
  'default' | 'success' | 'warning' | 'danger' | 'muted'
> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'muted',
};

export function LeaveTab({
  employeeId,
  canRequest,
  canApprove,
}: {
  employeeId: string;
  canRequest: boolean;
  canApprove: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [bal, reqs, tys] = await Promise.all([
        leaveApi.balances(employeeId),
        leaveApi.employeeRequests(employeeId),
        leaveApi.listTypes().catch(() => [] as LeaveType[]),
      ]);
      setBalances(bal);
      setRequests(reqs);
      setTypes(tys.filter((ty) => ty.isActive));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!form.leaveTypeId || !form.startDate || !form.endDate) return;
    setBusy(true);
    try {
      await leaveApi.createRequest(employeeId, form);
      setForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
      toast.success(t('common.saved'));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, action: 'approve' | 'reject' | 'cancel') {
    try {
      if (action === 'approve') await leaveApi.approve(id);
      else if (action === 'reject') await leaveApi.reject(id);
      else {
        if (!(await confirm())) return;
        await leaveApi.cancel(id);
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('hr.leaveBalances')}</CardTitle>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('hr.noBalances')}</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>{t('hr.leaveType')}</TH>
                  <TH>{t('hr.year')}</TH>
                  <TH className="text-end">{t('hr.entitled')}</TH>
                  <TH className="text-end">{t('hr.used')}</TH>
                  <TH className="text-end">{t('hr.remaining')}</TH>
                </TR>
              </THead>
              <TBody>
                {balances.map((b) => {
                  const entitled = Number(b.entitledDays);
                  const used = Number(b.usedDays);
                  return (
                    <TR key={b.id}>
                      <TD>{b.leaveType.name}</TD>
                      <TD>{b.year}</TD>
                      <TD className="text-end font-mono text-xs">{entitled}</TD>
                      <TD className="text-end font-mono text-xs">{used}</TD>
                      <TD className="text-end font-mono text-xs">{entitled - used}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canRequest ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('hr.requestLeave')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={t('hr.leaveType')}>
                <Select
                  value={form.leaveTypeId}
                  onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
                >
                  <option value="">—</option>
                  {types.map((ty) => (
                    <option key={ty.id} value={ty.id}>
                      {ty.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('common.reason')}>
                <Input
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </Field>
              <Field label={t('hr.startDate')}>
                <DatePicker
                  value={form.startDate}
                  onChange={(value) => setForm({ ...form, startDate: value })}
                />
              </Field>
              <Field label={t('hr.endDate')}>
                <DatePicker
                  value={form.endDate}
                  onChange={(value) => setForm({ ...form, endDate: value })}
                />
              </Field>
              <div className="sm:col-span-2 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => void submit()}
                  disabled={busy || !form.leaveTypeId || !form.startDate || !form.endDate}
                >
                  {t('hr.submitRequest')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('hr.leaveRequests')}</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('hr.noLeaveRequests')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {requests.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{r.leaveType.name}</span>
                    <Badge tone={STATUS_TONE[r.status]} className="ms-2">
                      {t(`hr.leaveStatus.${r.status}`)}
                    </Badge>
                    {r.status === 'PENDING' && r.requiredLevels > 1 ? (
                      <span className="ms-1 text-xs text-muted-foreground">
                        {t('hr.level')} {r.currentLevel}/{r.requiredLevels}
                      </span>
                    ) : null}
                    <span className="block text-xs text-muted-foreground">
                      {r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)} ·{' '}
                      {Number(r.workingDays)} {t('hr.days')}
                      {r.reason ? ` · ${r.reason}` : ''}
                    </span>
                  </div>
                  {r.status === 'PENDING' ? (
                    <div className="flex shrink-0 gap-1">
                      {canApprove ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void decide(r.id, 'approve')}
                          >
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
                        </>
                      ) : null}
                      {canRequest ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void decide(r.id, 'cancel')}
                        >
                          {t('common.cancel')}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

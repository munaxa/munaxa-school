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
import {
  attendanceApi,
  STAFF_ATTENDANCE_STATUSES,
  type StaffAttendance,
  type StaffAttendanceStatus,
} from '@/lib/people';

const STATUS_TONE: Record<
  StaffAttendanceStatus,
  'default' | 'success' | 'warning' | 'danger' | 'muted'
> = {
  PRESENT: 'success',
  REMOTE: 'success',
  LATE: 'warning',
  EARLY_DEPARTURE: 'warning',
  ABSENT: 'danger',
  ON_LEAVE: 'muted',
  HOLIDAY: 'muted',
};

export function AttendanceTab({
  employeeId,
  canManage,
}: {
  employeeId: string;
  canManage: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState<StaffAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const EMPTY = {
    date: new Date().toISOString().slice(0, 10),
    status: 'PRESENT' as StaffAttendanceStatus,
    lateMinutes: '',
    overtimeHours: '',
    note: '',
  };
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    try {
      setRows(await attendanceApi.listForEmployee(employeeId));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!form.date) return;
    setBusy(true);
    try {
      await attendanceApi.record(employeeId, {
        date: form.date,
        status: form.status,
        ...(form.lateMinutes ? { lateMinutes: Number(form.lateMinutes) } : {}),
        ...(form.overtimeHours ? { overtimeHours: Number(form.overtimeHours) } : {}),
        ...(form.note ? { note: form.note } : {}),
      });
      toast.success(t('common.saved'));
      setForm({ ...EMPTY, date: form.date });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;

  return (
    <div className="space-y-4">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('hr.recordAttendance')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t('hr.date')}>
                <DatePicker
                  value={form.date}
                  onChange={(value) => setForm({ ...form, date: value })}
                />
              </Field>
              <Field label={t('common.status')}>
                <Select
                  value={form.status}
                  onChange={(ev) =>
                    setForm({ ...form, status: ev.target.value as StaffAttendanceStatus })
                  }
                >
                  {STAFF_ATTENDANCE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`hr.attendanceStatus.${s}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('hr.lateMinutes')}>
                <Input
                  type="number"
                  dir="ltr"
                  min={0}
                  className="w-24"
                  value={form.lateMinutes}
                  onChange={(ev) => setForm({ ...form, lateMinutes: ev.target.value })}
                />
              </Field>
              <Field label={t('hr.overtimeHours')}>
                <Input
                  type="number"
                  dir="ltr"
                  min={0}
                  step="0.25"
                  className="w-24"
                  value={form.overtimeHours}
                  onChange={(ev) => setForm({ ...form, overtimeHours: ev.target.value })}
                />
              </Field>
              <Field label={t('common.note')} className="flex-1 min-w-40">
                <Input
                  value={form.note}
                  onChange={(ev) => setForm({ ...form, note: ev.target.value })}
                />
              </Field>
              <Button size="sm" onClick={() => void save()} disabled={busy || !form.date}>
                {t('common.save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('hr.attendanceHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('hr.noAttendance')}</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>{t('hr.date')}</TH>
                  <TH>{t('common.status')}</TH>
                  <TH className="text-end">{t('hr.lateMinutes')}</TH>
                  <TH className="text-end">{t('hr.overtimeHours')}</TH>
                  <TH>{t('common.note')}</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.id}>
                    <TD>{r.date.slice(0, 10)}</TD>
                    <TD>
                      <Badge tone={STATUS_TONE[r.status]}>
                        {t(`hr.attendanceStatus.${r.status}`)}
                      </Badge>
                      {r.correctedFromStatus ? (
                        <span className="ms-1 text-xs text-muted-foreground">
                          ({t('hr.correctedFrom')}{' '}
                          {t(`hr.attendanceStatus.${r.correctedFromStatus}`)})
                        </span>
                      ) : null}
                    </TD>
                    <TD className="text-end font-mono text-xs">{r.lateMinutes ?? '—'}</TD>
                    <TD className="text-end font-mono text-xs">
                      {r.overtimeHours != null ? Number(r.overtimeHours) : '—'}
                    </TD>
                    <TD className="text-muted-foreground">{r.note ?? ''}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

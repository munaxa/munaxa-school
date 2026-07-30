'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
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
import {
  essApi,
  type AssetAssignment,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type MyProfile,
  type PerformanceReview,
  type StaffAttendance,
  type StaffLeaveStatus,
  type TrainingRecord,
  leaveApi,
} from '@/lib/people';

const LEAVE_TONE: Record<StaffLeaveStatus, 'default' | 'success' | 'warning' | 'danger' | 'muted'> =
  {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    CANCELLED: 'muted',
  };

export default function MyHrPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [attendance, setAttendance] = useState<StaffAttendance[]>([]);
  const [assets, setAssets] = useState<AssetAssignment[]>([]);
  const [training, setTraining] = useState<TrainingRecord[]>([]);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, bal, reqs, tys, att, ast, trn, rev] = await Promise.all([
        essApi.profile(),
        essApi.leaveBalances().catch(() => [] as LeaveBalance[]),
        essApi.leaveRequests().catch(() => [] as LeaveRequest[]),
        leaveApi.listTypes().catch(() => [] as LeaveType[]),
        essApi.attendance().catch(() => [] as StaffAttendance[]),
        essApi.assets().catch(() => [] as AssetAssignment[]),
        essApi.training().catch(() => [] as TrainingRecord[]),
        essApi.reviews().catch(() => [] as PerformanceReview[]),
      ]);
      setProfile(p);
      setBalances(bal);
      setRequests(reqs);
      setTypes(tys.filter((ty) => ty.isActive));
      setAttendance(att);
      setAssets(ast);
      setTraining(trn);
      setReviews(rev);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!form.leaveTypeId || !form.startDate || !form.endDate) return;
    setBusy(true);
    try {
      await essApi.submitLeave(form);
      setForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
      toast.success(t('common.saved'));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    try {
      await essApi.cancelLeave(id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function acknowledge(id: string) {
    try {
      await essApi.acknowledgeReview(id);
      toast.success(t('common.saved'));
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

  if (error || !profile) {
    return (
      <Shell>
        <p className="text-sm text-destructive" role="alert">
          {error ?? t('hr.noProfile')}
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader title={t('hr.myHr')} />

        <Card>
          <CardHeader>
            <CardTitle>
              {profile.firstNameEn} {profile.lastNameEn}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <Detail label={t('people.jobTitle')} value={profile.jobTitle} />
            <Detail label={t('people.department')} value={profile.department?.name ?? '—'} />
            <Detail
              label={t('hr.manager')}
              value={
                profile.manager
                  ? `${profile.manager.firstNameEn} ${profile.manager.lastNameEn}`
                  : '—'
              }
            />
            <Detail label={t('hr.hireDate')} value={profile.hireDate?.slice(0, 10) ?? '—'} />
          </CardContent>
        </Card>

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
                    <TH className="text-end">{t('hr.remaining')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {balances.map((b) => (
                    <TR key={b.id}>
                      <TD>{b.leaveType.name}</TD>
                      <TD>{b.year}</TD>
                      <TD className="text-end font-mono text-xs">
                        {Number(b.entitledDays) - Number(b.usedDays)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

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

            {requests.length > 0 ? (
              <ul className="mt-4 divide-y divide-border">
                {requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{r.leaveType.name}</span>
                      <Badge tone={LEAVE_TONE[r.status]} className="ms-2">
                        {t(`hr.leaveStatus.${r.status}`)}
                      </Badge>
                      <span className="block text-xs text-muted-foreground">
                        {r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)} ·{' '}
                        {Number(r.workingDays)} {t('hr.days')}
                      </span>
                    </div>
                    {r.status === 'PENDING' || r.status === 'APPROVED' ? (
                      <Button variant="ghost" size="sm" onClick={() => void cancel(r.id)}>
                        {t('common.cancel')}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        {reviews.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('hr.tabPerformance')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {reviews.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      {r.cycle.name}
                      {r.overallRating != null ? (
                        <span className="ms-2 text-xs text-muted-foreground">
                          {t('hr.overallRating')}: {r.overallRating}/5
                        </span>
                      ) : null}
                    </span>
                    {r.status === 'SUBMITTED' ? (
                      <Button variant="ghost" size="sm" onClick={() => void acknowledge(r.id)}>
                        {t('hr.acknowledge')}
                      </Button>
                    ) : (
                      <Badge tone={r.status === 'ACKNOWLEDGED' ? 'success' : 'muted'}>
                        {t(`hr.reviewStatus.${r.status}`)}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 sm:grid-cols-3">
          <SummaryCard title={t('hr.tabAttendance')} count={attendance.length} />
          <SummaryCard
            title={t('hr.assignedAssets')}
            count={assets.filter((a) => !a.returnedAt).length}
          />
          <SummaryCard title={t('hr.trainingRecords')} count={training.length} />
        </div>
      </div>
    </Shell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-border/50 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SummaryCard({ title, count }: { title: string; count: number }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-3xl font-semibold">{count}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
      </CardContent>
    </Card>
  );
}

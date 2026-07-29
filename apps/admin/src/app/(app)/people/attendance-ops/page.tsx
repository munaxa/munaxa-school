'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Select,
  Spinner,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@axa/platform';
import { useI18n } from '@/components/i18n-provider';
import {
  attendanceOpsApi,
  type AttendanceAnalytics,
  type AttendanceLock,
  type AttendancePolicy,
  type CorrectionRequest,
  type LockScope,
  type Shift,
} from '@/lib/attendance-ops';

const LOCK_SCOPES: LockScope[] = ['DAY', 'WEEK', 'PAYROLL', 'SEMESTER'];
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${new Date().toISOString().slice(0, 7)}-01`;

/**
 * Attendance operations console: immutability locks, the correction inbox, policy/shift
 * configuration and analytics. Presentation only — every rule (what a lock covers, whether a
 * correction may be decided, how a period validates) is enforced by the API.
 */
export default function AttendanceOpsPage() {
  const toast = useToast();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [locks, setLocks] = useState<AttendanceLock[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [policies, setPolicies] = useState<AttendancePolicy[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [analytics, setAnalytics] = useState<AttendanceAnalytics | null>(null);

  const [range, setRange] = useState({ from: monthStart(), to: today() });
  const [lockForm, setLockForm] = useState<{
    scope: LockScope;
    periodStart: string;
    periodEnd: string;
    reason: string;
  }>({ scope: 'PAYROLL', periodStart: monthStart(), periodEnd: today(), reason: '' });

  const load = useCallback(async () => {
    try {
      const [l, c, p, s] = await Promise.all([
        attendanceOpsApi.listLocks(),
        attendanceOpsApi.listCorrections('PENDING'),
        attendanceOpsApi.listPolicies(),
        attendanceOpsApi.listShifts(),
      ]);
      setLocks(l);
      setCorrections(c);
      setPolicies(p);
      setShifts(s);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadAnalytics = useCallback(async () => {
    try {
      setAnalytics(await attendanceOpsApi.analytics(range.from, range.to));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load analytics');
    }
  }, [range, toast]);

  async function act<T>(fn: () => Promise<T>, success: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const activeLocks = useMemo(() => locks.filter((l) => l.status === 'ACTIVE'), [locks]);

  if (loading) {
    return (
      <Shell>
        <Spinner />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t('attendanceOps.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('attendanceOps.subtitle')}</p>
        </div>

        {/* ---- Locks ---- */}
        <Card>
          <CardHeader>
            <CardTitle>{t('attendanceOps.locks')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t('attendanceOps.scope')}>
                <Select
                  value={lockForm.scope}
                  onChange={(e) => setLockForm({ ...lockForm, scope: e.target.value as LockScope })}
                >
                  {LOCK_SCOPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('attendanceOps.from')}>
                <Input
                  type="date"
                  dir="ltr"
                  value={lockForm.periodStart}
                  onChange={(e) => setLockForm({ ...lockForm, periodStart: e.target.value })}
                />
              </Field>
              <Field label={t('attendanceOps.to')}>
                <Input
                  type="date"
                  dir="ltr"
                  value={lockForm.periodEnd}
                  onChange={(e) => setLockForm({ ...lockForm, periodEnd: e.target.value })}
                />
              </Field>
              <Field label={t('common.note')} className="flex-1 min-w-40">
                <Input
                  value={lockForm.reason}
                  onChange={(e) => setLockForm({ ...lockForm, reason: e.target.value })}
                />
              </Field>
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  void act(
                    () =>
                      attendanceOpsApi.createLock({
                        scope: lockForm.scope,
                        periodStart: lockForm.periodStart,
                        periodEnd: lockForm.periodEnd,
                        ...(lockForm.reason ? { reason: lockForm.reason } : {}),
                      }),
                    t('attendanceOps.locked'),
                  )
                }
              >
                {t('attendanceOps.lockPeriod')}
              </Button>
            </div>

            {locks.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('attendanceOps.noLocks')}</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>{t('attendanceOps.scope')}</TH>
                    <TH>{t('attendanceOps.period')}</TH>
                    <TH>{t('common.status')}</TH>
                    <TH>{t('common.note')}</TH>
                    <TH className="text-end">{t('common.actions')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {locks.map((l) => (
                    <TR key={l.id}>
                      <TD>{l.scope}</TD>
                      <TD className="font-mono text-xs">
                        {l.periodStart.slice(0, 10)} → {l.periodEnd.slice(0, 10)}
                      </TD>
                      <TD>
                        <Badge tone={l.status === 'ACTIVE' ? 'warning' : 'muted'}>{l.status}</Badge>
                      </TD>
                      <TD className="text-muted-foreground">{l.reason ?? ''}</TD>
                      <TD className="text-end">
                        {l.status === 'ACTIVE' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void act(
                                () => attendanceOpsApi.releaseLock(l.id),
                                t('attendanceOps.released'),
                              )
                            }
                          >
                            {t('attendanceOps.release')}
                          </Button>
                        ) : null}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ---- Correction inbox ---- */}
        <Card>
          <CardHeader>
            <CardTitle>
              {t('attendanceOps.corrections')}{' '}
              {corrections.length > 0 ? <Badge tone="warning">{corrections.length}</Badge> : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {corrections.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('attendanceOps.noCorrections')}</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>{t('hr.date')}</TH>
                    <TH>{t('attendanceOps.employee')}</TH>
                    <TH>{t('attendanceOps.change')}</TH>
                    <TH>{t('attendanceOps.reason')}</TH>
                    <TH>{t('attendanceOps.level')}</TH>
                    <TH className="text-end">{t('common.actions')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {corrections.map((c) => (
                    <TR key={c.id}>
                      <TD className="font-mono text-xs">{c.date.slice(0, 10)}</TD>
                      <TD>
                        {c.employee
                          ? `${c.employee.firstNameEn} ${c.employee.lastNameEn}`
                          : c.employeeId}
                      </TD>
                      <TD>
                        <span className="text-muted-foreground">{c.previousStatus ?? '—'}</span>
                        {' → '}
                        <Badge tone="default">{c.requestedStatus}</Badge>
                      </TD>
                      <TD className="max-w-60 truncate text-muted-foreground">{c.reason}</TD>
                      <TD className="font-mono text-xs">
                        {c.currentLevel}/{c.requiredLevels}
                      </TD>
                      <TD className="text-end">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void act(
                                () => attendanceOpsApi.approveCorrection(c.id),
                                t('attendanceOps.approved'),
                              )
                            }
                          >
                            {t('common.approve')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void act(
                                () => attendanceOpsApi.rejectCorrection(c.id),
                                t('attendanceOps.rejected'),
                              )
                            }
                          >
                            {t('common.reject')}
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ---- Policies & shifts ---- */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('attendanceOps.policies')}</CardTitle>
            </CardHeader>
            <CardContent>
              {policies.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('attendanceOps.noPolicies')}</p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>{t('common.name')}</TH>
                      <TH className="text-end">{t('attendanceOps.grace')}</TH>
                      <TH className="text-end">{t('attendanceOps.absentAfter')}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {policies.map((p) => (
                      <TR key={p.id}>
                        <TD>
                          {p.name}{' '}
                          {p.isDefault ? (
                            <Badge tone="success">{t('attendanceOps.default')}</Badge>
                          ) : null}
                        </TD>
                        <TD className="text-end font-mono text-xs">{p.graceMinutes}m</TD>
                        <TD className="text-end font-mono text-xs">{p.absentAfterMinutes}m</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('attendanceOps.shifts')}</CardTitle>
            </CardHeader>
            <CardContent>
              {shifts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('attendanceOps.noShifts')}</p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>{t('common.name')}</TH>
                      <TH>{t('attendanceOps.window')}</TH>
                      <TH className="text-end">{t('attendanceOps.break')}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {shifts.map((s) => (
                      <TR key={s.id}>
                        <TD>
                          {s.name} <span className="text-xs text-muted-foreground">{s.kind}</span>
                        </TD>
                        <TD className="font-mono text-xs" dir="ltr">
                          {s.expectedCheckIn}–{s.expectedCheckOut}
                        </TD>
                        <TD className="text-end font-mono text-xs">{s.breakMinutes}m</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ---- Analytics ---- */}
        <Card>
          <CardHeader>
            <CardTitle>{t('attendanceOps.analytics')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t('attendanceOps.from')}>
                <Input
                  type="date"
                  dir="ltr"
                  value={range.from}
                  onChange={(e) => setRange({ ...range, from: e.target.value })}
                />
              </Field>
              <Field label={t('attendanceOps.to')}>
                <Input
                  type="date"
                  dir="ltr"
                  value={range.to}
                  onChange={(e) => setRange({ ...range, to: e.target.value })}
                />
              </Field>
              <Button size="sm" onClick={() => void loadAnalytics()}>
                {t('attendanceOps.run')}
              </Button>
            </div>

            {analytics ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge tone="default">
                    {t('attendanceOps.days')} {analytics.trend.length}
                  </Badge>
                  <Badge tone="danger">
                    {t('attendanceOps.absences')}{' '}
                    {analytics.trend.reduce((n, p) => n + p.absent, 0)}
                  </Badge>
                  <Badge tone="warning">
                    {t('attendanceOps.lates')} {analytics.trend.reduce((n, p) => n + p.late, 0)}
                  </Badge>
                </div>

                {analytics.departments.length > 0 ? (
                  <Table>
                    <THead>
                      <TR>
                        <TH>{t('attendanceOps.department')}</TH>
                        <TH className="text-end">{t('attendanceOps.employees')}</TH>
                        <TH className="text-end">{t('attendanceOps.absenceRate')}</TH>
                        <TH className="text-end">{t('attendanceOps.latenessRate')}</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {analytics.departments.map((d) => (
                        <TR key={d.departmentId ?? 'none'}>
                          <TD>{d.departmentName}</TD>
                          <TD className="text-end font-mono text-xs">{d.employees}</TD>
                          <TD className="text-end font-mono text-xs">
                            {(d.absenceRate * 100).toFixed(1)}%
                          </TD>
                          <TD className="text-end font-mono text-xs">
                            {(d.latenessRate * 100).toFixed(1)}%
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('attendanceOps.noData')}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('attendanceOps.runHint')}</p>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          {t('attendanceOps.activeLocksHint')} {activeLocks.length}
        </p>
      </div>
    </Shell>
  );
}

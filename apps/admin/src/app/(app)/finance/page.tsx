'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shell } from '@/components/shell';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  EmptyState,
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
import { FinanceTab } from '@/app/(app)/people/students/[studentId]/tabs/finance-tab';
import {
  familiesApi,
  type BillingSchedule,
  type BillingScheduleLine,
  type BillingScheduleStatus,
  type FamilyDashboard,
  type FamilySearchHit,
  type FinanceOverview,
  type PaymentMethod,
} from '@/lib/families';

const jod = (v: string | number) => `${Number(v).toFixed(3)} JOD`;
const dateStr = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : '—');

const METHODS: PaymentMethod[] = ['CASH', 'CLIQ', 'EWALLET', 'BANK_TRANSFER', 'CHEQUE', 'CARD'];

const COLLECTION_TONE: Record<string, 'success' | 'warning' | 'danger' | 'muted'> = {
  NONE: 'success',
  FINANCIAL_ISSUE: 'warning',
  LEGAL: 'danger',
};

/**
 * Finance — the ONE finance console, account-first. Search by guardian / family name / phone /
 * national id / student; every search resolves to the Financial Account. The account totals (KPIs)
 * are the default view; expanding a child drills into that student's full ledger (the shared
 * FinanceTab) without leaving the account. All plan/payment operations happen at the account.
 * Munaxa Design System components only; RTL/LTR + dark/light inherited.
 */
export default function FinancePage() {
  return (
    <Suspense fallback={null}>
      <FinanceWorkspace />
    </Suspense>
  );
}

function FinanceWorkspace() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState('');
  const [hits, setHits] = useState<FamilySearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [dashboard, setDashboard] = useState<FamilyDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  // Account-centric workspace dashboard (default state, before an account is opened).
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // The open account's Billing Schedule (dynamic read model — reloaded with the account).
  const [schedule, setSchedule] = useState<BillingSchedule | null>(null);

  const accountId = dashboard?.account.id ?? null;
  useEffect(() => {
    if (!accountId) {
      setSchedule(null);
      return;
    }
    let active = true;
    setSchedule(null);
    void (async () => {
      try {
        const s = await familiesApi.schedule(accountId);
        if (active) setSchedule(s);
      } catch {
        // Non-fatal: the schedule is a read view; the rest of the workspace still works.
      }
    })();
    return () => {
      active = false;
    };
  }, [accountId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const o = await familiesApi.overview();
        if (active) setOverview(o);
      } catch {
        // Non-fatal: the dashboard is a convenience surface; search still works without it.
      } finally {
        if (active) setOverviewLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const openAccountById = async (payerId: string, expandStudentId?: string) => {
    setLoading(true);
    setHits(null);
    setExpanded(expandStudentId ?? null);
    try {
      setDashboard(await familiesApi.dashboard(payerId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load the account');
    } finally {
      setLoading(false);
    }
  };

  // Deep links: ?account=<payerId> opens that account directly; ?studentId=<id> resolves the student
  // to their Financial Account and opens the workspace with that student expanded ("Open in finance").
  // A guardian-less student routes to their profile.
  const deepLinkAccount = searchParams.get('account');
  const deepLinkStudent = searchParams.get('studentId');
  useEffect(() => {
    if (deepLinkAccount) {
      void openAccountById(deepLinkAccount);
      return;
    }
    if (!deepLinkStudent) return;
    let active = true;
    void (async () => {
      try {
        const { account } = await familiesApi.byStudent(deepLinkStudent);
        if (!active) return;
        if (account) {
          await openAccountById(account.id, deepLinkStudent);
        } else {
          toast.error('This student has no account yet — assign a guardian to bill them');
          router.push(`/people/students/${deepLinkStudent}`);
        }
      } catch (err) {
        if (active) toast.error(err instanceof Error ? err.message : 'Could not open the account');
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkAccount, deepLinkStudent]);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (q.trim().length < 2) {
      toast.error('Type at least 2 characters to search');
      return;
    }
    setSearching(true);
    try {
      setHits(await familiesApi.search(q.trim()));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const openAccount = async (hit: FamilySearchHit) => {
    // A guardian-less student: no account can exist until a paying guardian is assigned. Send the
    // user to the student's profile to assign one — that links the student to the guardian's account.
    if (hit.studentId) {
      toast.error('This student has no guardian yet — assign one to bill them through an account');
      router.push(`/people/students/${hit.studentId}`);
      return;
    }
    if (!hit.financialAccountId) {
      toast.error('This guardian has no account yet — register them via Admission');
      return;
    }
    setLoading(true);
    setHits(null);
    setExpanded(null);
    try {
      setDashboard(await familiesApi.dashboard(hit.financialAccountId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load the account');
    } finally {
      setLoading(false);
    }
  };

  // After a payment/allocation, refresh BOTH the account totals and the Billing Schedule (the
  // schedule is a read model — it must reflect the new allocation, and its own effect won't re-run
  // because the account id is unchanged).
  const reload = async () => {
    if (!dashboard) return;
    const id = dashboard.account.id;
    const [fresh, sched] = await Promise.all([
      familiesApi.dashboard(id),
      familiesApi.schedule(id).catch(() => null),
    ]);
    setDashboard(fresh);
    if (sched) setSchedule(sched);
  };

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-display text-2xl font-semibold">Finance</h1>
          <p className="text-sm text-muted-foreground">
            Search an account and manage its finances — one account pays for all its students.
          </p>
        </header>

        <Card>
          <CardContent className="p-4">
            <form onSubmit={(e) => void search(e)} className="flex gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Guardian, family name, phone, national ID or student…"
                aria-label="Search finance accounts"
              />
              <Button type="submit" disabled={searching}>
                {searching ? 'Searching…' : 'Search'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {hits && (
          <Card>
            <CardHeader>
              <CardTitle>Results ({hits.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {hits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No accounts matched your search.</p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Account holder</TH>
                      <TH>Phone</TH>
                      <TH>National ID</TH>
                      <TH>Students</TH>
                      <TH>Account</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {hits.map((h) => (
                      <TR
                        key={h.parentId ?? h.financialAccountId ?? h.studentId ?? h.nameEn}
                        className="cursor-pointer"
                        onClick={() => void openAccount(h)}
                      >
                        <TD>{h.nameEn}</TD>
                        <TD>{h.phone ?? '—'}</TD>
                        <TD>{h.nationalId ?? '—'}</TD>
                        <TD>{h.studentId ? '—' : h.studentCount}</TD>
                        <TD>
                          {h.financialAccountId ? (
                            <Badge tone="success">Account</Badge>
                          ) : h.studentId ? (
                            <Badge tone="warning">Student · no guardian</Badge>
                          ) : (
                            <Badge tone="muted">No account</Badge>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {loading && <Spinner />}

        {!loading && dashboard && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-semibold">{dashboard.account.nameEn}</h2>
                <p className="text-sm text-muted-foreground">
                  {dashboard.account.ownerType.replace('_', ' ')} ·{' '}
                  {dashboard.account.phone ?? 'no phone'}
                </p>
              </div>
              <Button onClick={() => setPayOpen(true)}>Record payment</Button>
            </div>

            {/* Account totals — the default view */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Metric label="Total charges" value={jod(dashboard.summary.netCharged)} />
              <Metric label="Total paid" value={jod(dashboard.summary.paid)} />
              <Metric label="Outstanding" value={jod(dashboard.summary.outstanding)} />
              <Metric label="Credit balance" value={jod(dashboard.summary.creditBalance)} />
              <Metric
                label="Next due"
                value={
                  dashboard.summary.nextDue
                    ? `${jod(dashboard.summary.nextDue.amount)} · ${dateStr(dashboard.summary.nextDue.dueDate)}`
                    : '—'
                }
              />
              <Metric
                label="Last payment"
                value={
                  dashboard.summary.lastPayment
                    ? `${jod(dashboard.summary.lastPayment.amount)} · ${dateStr(dashboard.summary.lastPayment.date)}`
                    : '—'
                }
              />
              <MetricNode label="Collection status">
                <Badge tone={COLLECTION_TONE[dashboard.summary.collectionStatus] ?? 'muted'}>
                  {dashboard.summary.collectionStatus.replace('_', ' ')}
                </Badge>
              </MetricNode>
              <Metric label="Students" value={String(dashboard.summary.childrenCount)} />
            </div>

            {/* The account Billing Schedule — the single, dynamically merged plan across all students. */}
            {schedule && <BillingScheduleCard schedule={schedule} />}

            <Card>
              <CardHeader>
                <CardTitle>Children ({dashboard.students.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboard.students.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No students on this account.</p>
                ) : (
                  dashboard.students.map((s) => (
                    <div key={s.studentId} className="rounded-md border border-border">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between p-3 text-start"
                        onClick={() => setExpanded(expanded === s.studentId ? null : s.studentId)}
                      >
                        <span className="font-medium">
                          {s.firstNameEn} {s.lastNameEn}
                          <span className="ms-2 text-sm text-muted-foreground">
                            {s.gradeNameEn ?? ''}
                          </span>
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {expanded === s.studentId ? 'Hide' : 'View ledger'}
                        </span>
                      </button>
                      {expanded === s.studentId && (
                        <div className="border-t border-border p-3">
                          <FinanceTab studentId={s.studentId} />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Default state: the account-centric finance dashboard, embedded below the search. */}
        {!loading && !dashboard && !hits && (
          <>
            {overviewLoading && <Spinner />}
            {!overviewLoading && overview && (
              <FinanceDashboardPanel
                overview={overview}
                onOpen={(id) => void openAccountById(id)}
              />
            )}
            {!overviewLoading && !overview && <EmptyState title="Search for an account to begin" />}
          </>
        )}
      </div>

      {dashboard && (
        <RecordPaymentDialog
          open={payOpen}
          onClose={() => setPayOpen(false)}
          accountName={dashboard.account.nameEn}
          openLines={(schedule?.rows ?? [])
            .flatMap((r) => r.lines)
            .filter((l) => Number(l.balance) > 0)}
          onSubmit={async (amount, method, reference, note, allocations) => {
            await familiesApi.recordPayment(dashboard.account.id, {
              amount,
              method,
              ...(reference ? { reference } : {}),
              ...(note ? { note } : {}),
              ...(allocations && allocations.length > 0 ? { allocations } : {}),
            });
            toast.success('Payment recorded and allocated');
            setPayOpen(false);
            await reload();
          }}
        />
      )}
    </Shell>
  );
}

const SCHEDULE_TONE: Record<BillingScheduleStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  PAID: 'success',
  PARTIAL: 'warning',
  OVERDUE: 'danger',
  UPCOMING: 'muted',
};

/**
 * The Financial Account's Billing Schedule — ONE plan, computed dynamically by merging every
 * student's installments by due date (no persisted account plan). Expanding a row reveals the
 * per-student / per-fee lines that make it up (informational drill-down only; money moves via the
 * account's Record payment). Munaxa Design System only.
 */
function BillingScheduleCard({ schedule }: { schedule: BillingSchedule }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Billing schedule</CardTitle>
        <span className="text-sm text-muted-foreground">
          Outstanding {jod(schedule.totals.balance)} of {jod(schedule.totals.amount)}
        </span>
      </CardHeader>
      <CardContent>
        {schedule.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No installments scheduled.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Due date</TH>
                <TH>Amount</TH>
                <TH>Paid</TH>
                <TH>Balance</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {schedule.rows.map((row, i) => {
                const key = row.dueDate ?? `undated-${i}`;
                const isOpen = open === key;
                return (
                  <FragmentRow
                    key={key}
                    row={row}
                    isOpen={isOpen}
                    onToggle={() => setOpen(isOpen ? null : key)}
                  />
                );
              })}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/** A schedule row plus its expandable per-student/per-fee breakdown. */
function FragmentRow({
  row,
  isOpen,
  onToggle,
}: {
  row: BillingSchedule['rows'][number];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TR className="cursor-pointer" onClick={onToggle}>
        <TD>
          <span className="me-2 text-muted-foreground">{isOpen ? '▼' : '▶'}</span>
          {row.dueDate ? dateStr(row.dueDate) : 'Undated'}
        </TD>
        <TD>{jod(row.amount)}</TD>
        <TD>{jod(row.paid)}</TD>
        <TD>{jod(row.balance)}</TD>
        <TD>
          <Badge tone={SCHEDULE_TONE[row.status]}>{row.status}</Badge>
        </TD>
      </TR>
      {isOpen &&
        row.lines.map((l, j) => (
          <TR key={`${l.studentId}-${l.chargeDescription}-${j}`} className="bg-muted/30">
            <TD className="ps-8 text-sm text-muted-foreground">
              {l.studentName} · {l.chargeDescription}
            </TD>
            <TD className="text-sm">{jod(l.amount)}</TD>
            <TD className="text-sm">{jod(l.paid)}</TD>
            <TD className="text-sm">{jod(l.balance)}</TD>
            <TD>
              <Badge tone={SCHEDULE_TONE[l.status]}>{l.status}</Badge>
            </TD>
          </TR>
        ))}
    </>
  );
}

/**
 * Account-centric finance dashboard — the default state of the workspace, embedded under the search.
 * Every widget is a tenant-wide aggregate over the ledger; accounts (never students) are the rows.
 * Clicking an account opens its workspace in place.
 */
function FinanceDashboardPanel({
  overview,
  onOpen,
}: {
  overview: FinanceOverview;
  onOpen: (payerId: string) => void;
}) {
  const k = overview.kpis;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Total outstanding" value={jod(k.totalOutstanding)} />
        <Metric label="Collected today" value={jod(k.collectedToday)} />
        <Metric label="Collected this month" value={jod(k.collectedThisMonth)} />
        <Metric label="Overdue accounts" value={String(k.overdueAccounts)} />
        <Metric label="Pending installments" value={String(k.pendingInstallments)} />
        <Metric label="Active payment plans" value={String(k.activePaymentPlans)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Largest outstanding accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.largestOutstandingAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outstanding balances.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Family</TH>
                  <TH>Outstanding</TH>
                  <TH>Next due</TH>
                  <TH>Collection</TH>
                </TR>
              </THead>
              <TBody>
                {overview.largestOutstandingAccounts.map((a) => (
                  <TR key={a.payerId} className="cursor-pointer" onClick={() => onOpen(a.payerId)}>
                    <TD>{a.name}</TD>
                    <TD>{jod(a.outstanding)}</TD>
                    <TD>
                      {a.nextDueDate
                        ? `${jod(a.nextDueAmount ?? 0)} · ${dateStr(a.nextDueDate)}`
                        : '—'}
                    </TD>
                    <TD>
                      <Badge tone={COLLECTION_TONE[a.collectionStatus] ?? 'muted'}>
                        {a.collectionStatus.replace('_', ' ')}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent payments</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Account</TH>
                    <TH>Amount</TH>
                    <TH>Method</TH>
                    <TH>Date</TH>
                  </TR>
                </THead>
                <TBody>
                  {overview.recentPayments.map((p) => (
                    <TR
                      key={p.id}
                      className={p.payerId ? 'cursor-pointer' : ''}
                      onClick={() => p.payerId && onOpen(p.payerId)}
                    >
                      <TD>{p.accountName}</TD>
                      <TD>{jod(p.amount)}</TD>
                      <TD>{p.method.replace('_', ' ')}</TD>
                      <TD>{dateStr(p.at)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming installments</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.upcomingInstallments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming installments.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Account</TH>
                    <TH>Due</TH>
                    <TH>Amount</TH>
                  </TR>
                </THead>
                <TBody>
                  {overview.upcomingInstallments.map((i, idx) => (
                    <TR
                      key={`${i.payerId}-${i.dueDate}-${idx}`}
                      className="cursor-pointer"
                      onClick={() => onOpen(i.payerId)}
                    >
                      <TD>{i.accountName}</TD>
                      <TD>{dateStr(i.dueDate)}</TD>
                      <TD>{jod(i.amount)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <MetricNode label={label}>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </MetricNode>
  );
}

function MetricNode({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        {children}
      </CardContent>
    </Card>
  );
}

function RecordPaymentDialog({
  open,
  onClose,
  accountName,
  openLines,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  accountName: string;
  openLines: BillingScheduleLine[];
  onSubmit: (
    amount: number,
    method: PaymentMethod,
    reference: string,
    note: string,
    allocations?: Array<{ installmentId: string; amount: number }>,
  ) => Promise<void>;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [manual, setManual] = useState(false);
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setAmount('');
    setReference('');
    setNote('');
    setManual(false);
    setAlloc({});
  };

  const allocated = Object.values(alloc).reduce((s, v) => s + (Number(v) || 0), 0);
  const value = Number(amount);
  const remaining = (Number.isFinite(value) ? value : 0) - allocated;

  const submit = async () => {
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    let allocations: Array<{ installmentId: string; amount: number }> | undefined;
    if (manual) {
      allocations = Object.entries(alloc)
        .map(([installmentId, v]) => ({ installmentId, amount: Number(v) }))
        .filter((a) => a.amount > 0);
      if (allocations.length === 0) {
        toast.error('Assign the payment to at least one installment, or switch to Automatic');
        return;
      }
      if (allocated > value + 1e-9) {
        toast.error('Allocated more than the payment amount');
        return;
      }
    }
    setBusy(true);
    try {
      await onSubmit(value, method, reference.trim(), note.trim(), allocations);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record the payment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Record a payment — ${accountName}`}>
      <div className="space-y-4">
        <Field label="Amount (JOD)">
          <Input
            type="number"
            step="0.001"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Method">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>

        {/* Allocation: automatic (cross-student FIFO) or manual (assign to specific installments). */}
        <Field label="Allocation">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={!manual} onChange={() => setManual(false)} />
              Automatic
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={manual}
                onChange={() => setManual(true)}
                disabled={openLines.length === 0}
              />
              Manual
            </label>
          </div>
        </Field>

        {!manual && (
          <p className="text-sm text-muted-foreground">
            The payment is recorded once and automatically allocated across the account’s
            installments (earliest due first); any surplus is kept as account credit.
          </p>
        )}

        {manual && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Assign amounts to specific installments. Unassigned surplus is kept as account credit.
            </p>
            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              <Table>
                <THead>
                  <TR>
                    <TH>Student · fee</TH>
                    <TH>Due</TH>
                    <TH>Balance</TH>
                    <TH>Apply</TH>
                  </TR>
                </THead>
                <TBody>
                  {openLines.map((l) => (
                    <TR key={l.installmentId}>
                      <TD className="text-sm">
                        {l.studentName} · {l.chargeDescription}
                      </TD>
                      <TD className="text-sm">{jod(l.balance)}</TD>
                      <TD className="w-28">
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          max={l.balance}
                          value={alloc[l.installmentId] ?? ''}
                          onChange={(e) =>
                            setAlloc((prev) => ({ ...prev, [l.installmentId]: e.target.value }))
                          }
                        />
                      </TD>
                      <TD className="text-sm">
                        <button
                          type="button"
                          className="text-primary-strong underline"
                          onClick={() =>
                            setAlloc((prev) => ({ ...prev, [l.installmentId]: l.balance }))
                          }
                        >
                          Fill
                        </button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Allocated {jod(allocated)}</span>
              <span className={remaining < -1e-9 ? 'text-accent-warm' : 'text-muted-foreground'}>
                {remaining >= 0
                  ? `Surplus → credit ${jod(remaining)}`
                  : `Over by ${jod(-remaining)}`}
              </span>
            </div>
          </div>
        )}

        <Field label="Reference (optional)">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? 'Recording…' : 'Record payment'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

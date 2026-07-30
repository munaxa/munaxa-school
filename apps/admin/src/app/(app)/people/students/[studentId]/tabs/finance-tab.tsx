'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DatePicker,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@axa/platform';
import { ChargeStatusBadge, TransactionStatusBadge } from '@/components/domain';
import { FeeModifiedBadge } from '@/components/fee-modified-badge';
import { DocumentsSection } from './documents-section';
import { documentsApi } from '@/lib/documents';
import {
  financeApi,
  type ChargeView,
  type CollectionsProfile,
  type Installment,
  type Statement,
} from '@/lib/finance';

const mediumLabel: Record<string, string> = {
  PHONE: 'Phone call',
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
  EMAIL: 'Email',
  MEETING: 'Meeting',
  NOTE: 'Note',
};

const PAYMENT_METHODS = ['CASH', 'CLIQ', 'EWALLET', 'BANK_TRANSFER'] as const;
const CADENCES = ['MONTHLY', 'WEEKLY', 'QUARTERLY'] as const;
const COMM_MEDIUMS = ['PHONE', 'WHATSAPP', 'SMS', 'EMAIL', 'MEETING', 'NOTE'] as const;
const REMINDER_LEVELS = [
  { value: '', label: 'Reminder…' },
  { value: 'FRIENDLY', label: 'Friendly' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'FINAL', label: 'Final' },
  { value: 'TRANSPORT_WARNING', label: 'Transport warning' },
  { value: 'SUSPENSION_NOTICE', label: 'Suspension notice' },
] as const;

function promiseTone(status: string): 'success' | 'warning' | 'danger' | 'muted' {
  if (status === 'KEPT') return 'success';
  if (status === 'BROKEN') return 'danger';
  if (status === 'OVERDUE') return 'warning';
  return 'muted';
}
const ADJUSTMENT_TYPES = [
  'DISCOUNT',
  'SCHOLARSHIP',
  'SIBLING_DISCOUNT',
  'STAFF_DISCOUNT',
  'WAIVER',
  'WRITE_OFF',
] as const;

const num = (v: string | number) => Number(v).toFixed(3);
const dateStr = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : '—');
const receiptLabel = (n: number) => `RCPT-${String(n).padStart(6, '0')}`;

function installmentTone(inst: Installment): 'success' | 'warning' | 'danger' | 'muted' {
  if (inst.status === 'PAID' || inst.status === 'WAIVED') return 'success';
  if (inst.overdue) return 'danger';
  if (inst.status === 'PARTIAL') return 'warning';
  return 'muted';
}

/**
 * Student Financial Account workspace — the hierarchical AR view (Finance Domain Spec v1.0 §16):
 *
 *   Student Financial Account (Outstanding · Paid · Credits · Refunds · Collections)
 *     ▼ Charge (obligation)  gross · discount · net · outstanding
 *         Payment Plan (cadence × N)
 *           Installment 1..N (due · amount · paid · balance · status)
 *     ▶ Charge …
 *   Payments · Credits · Refunds · Adjustments · Documents
 *
 * Every figure comes from the ledger (single source of truth). No duplicated charges, no flat
 * installment list — installments live only inside their plan. Munaxa Design System only.
 *
 * Preview-only by default (`readOnly`): a student's finance is a read view of the ledger. Money is
 * moved and the account is managed at the FINANCIAL ACCOUNT level in the Finance module — one
 * account pays for all its students — so every mutating control is hidden here. Pass
 * `readOnly={false}` only from a surface that is explicitly authorised to transact per-student.
 */
export function FinanceTab({
  studentId,
  readOnly = true,
}: {
  studentId: string;
  readOnly?: boolean;
}) {
  useI18n();
  const toast = useToast();
  const [statement, setStatement] = useState<Statement | null>(null);
  const [collections, setCollections] = useState<CollectionsProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  // Inline forms.
  const [payForm, setPayForm] = useState({ amount: '', method: 'CASH', reference: '' });
  const [planForm, setPlanForm] = useState<{
    chargeId: string;
    cadence: string;
    installments: string;
    firstDueDate: string;
    reason: string;
    isReplace: boolean;
  } | null>(null);
  const [adjForm, setAdjForm] = useState<{
    chargeId: string;
    type: string;
    amount: string;
    reason: string;
  } | null>(null);
  const [refundForm, setRefundForm] = useState({ amount: '', method: 'CASH', reason: '' });
  const [promiseForm, setPromiseForm] = useState({ amount: '', promiseBy: '', note: '' });
  const [commForm, setCommForm] = useState<{ medium: string; note: string }>({
    medium: 'PHONE',
    note: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, c] = await Promise.all([
        financeApi.statement(studentId),
        financeApi.collections(studentId).catch(() => null),
      ]);
      setStatement(s);
      setCollections(c);
      setExpanded((prev) => {
        const next = { ...prev };
        for (const cv of s.charges)
          if (next[cv.charge.id] === undefined) next[cv.charge.id] = Number(cv.balance) > 0;
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load finance');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = statement?.totals;
  const activeCharges = useMemo(
    () => (statement?.charges ?? []).filter((c) => c.charge.status !== 'CANCELLED'),
    [statement],
  );

  async function run(action: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await action();
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitPayment() {
    const amount = Number(payForm.amount);
    if (!amount || amount <= 0) return toast.error('Enter an amount in JOD');
    setBusy(true);
    try {
      const p = await financeApi.recordPayment({
        studentId,
        amount,
        method: payForm.method,
        ...(payForm.reference ? { reference: payForm.reference } : {}),
      });
      await financeApi.verify(p.id); // record + verify (auto-allocates FIFO to installments)
      setPayForm({ amount: '', method: 'CASH', reference: '' });
      await load();
      // Confirm the outcome to the cashier: when the payment clears the account, say so — and if it
      // over-pays, make it explicit that the surplus is kept as credit for the student.
      const fresh = await financeApi.statement(studentId);
      const outstanding = Number(fresh.totals.outstanding);
      const credit = Number(fresh.totals.creditBalance);
      if (outstanding <= 0 && credit > 0) {
        toast.success(
          `Payment recorded — no outstanding balance remains. ${num(credit)} JOD is kept as credit for the student.`,
        );
      } else if (outstanding <= 0) {
        toast.success('Payment recorded — the account is fully settled, no outstanding balance.');
      } else {
        toast.success('Payment recorded and allocated');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Settle a one-time charge (the registration fee) in full: record a cash payment for its
   * outstanding balance and verify it. Verification auto-allocates FIFO, and the registration fee is
   * the earliest-due obligation, so the payment lands on it. For anything else (method, part payment)
   * the cashier uses the Record payment form below.
   */
  async function payCharge(cv: ChargeView) {
    const balance = Number(cv.balance);
    if (!balance || balance <= 0) return;
    if (
      !window.confirm(
        `Record a cash payment of ${num(cv.balance)} JOD for "${cv.charge.description}"?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const p = await financeApi.recordPayment({ studentId, amount: balance, method: 'CASH' });
      await financeApi.verify(p.id);
      toast.success(`${cv.charge.description} paid`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not record the payment');
    } finally {
      setBusy(false);
    }
  }

  async function submitPlan() {
    if (!planForm) return;
    const installments = Number(planForm.installments);
    if (!installments || installments < 1) return toast.error('Enter a number of installments');
    if (!planForm.firstDueDate) return toast.error('Choose a first due date');
    if (planForm.isReplace) {
      if (!planForm.reason.trim()) return toast.error('A reason is required to renegotiate a plan');
      if (
        !window.confirm(
          'Renegotiate the active payment plan?\n\nThe current plan will be superseded (kept for ' +
            'history), and a new plan will be generated for the OUTSTANDING balance only. Existing ' +
            'payments and allocations are preserved. This is an exceptional administrative action.',
        )
      ) {
        return;
      }
    }
    await run(
      async () => {
        await financeApi.createPlan(planForm.chargeId, {
          cadence: planForm.cadence as 'MONTHLY',
          installments,
          firstDueDate: planForm.firstDueDate,
          ...(planForm.isReplace ? { reason: planForm.reason.trim() } : {}),
        });
        setPlanForm(null);
      },
      planForm.isReplace ? 'Payment plan renegotiated' : 'Payment plan created',
    );
  }

  async function submitAdjustment() {
    if (!adjForm) return;
    const amount = Number(adjForm.amount);
    if (!amount || amount <= 0) return toast.error('Enter a discount amount');
    if (!adjForm.reason.trim()) return toast.error('A reason is required');
    await run(async () => {
      await financeApi.applyAdjustment({
        studentId,
        chargeId: adjForm.chargeId,
        type: adjForm.type,
        amount,
        reason: adjForm.reason,
      });
      setAdjForm(null);
    }, 'Adjustment applied');
  }

  async function submitRefund() {
    const amount = Number(refundForm.amount);
    if (!amount || amount <= 0) return toast.error('Enter a refund amount');
    if (!refundForm.reason.trim()) return toast.error('A reason is required');
    await run(async () => {
      await financeApi.createRefund({
        studentId,
        amount,
        method: refundForm.method,
        reason: refundForm.reason,
      });
      setRefundForm({ amount: '', method: 'CASH', reason: '' });
    }, 'Refund requested (pending verification)');
  }

  async function submitPromise() {
    const amount = Number(promiseForm.amount);
    if (!amount || amount <= 0) return toast.error('Enter a promised amount');
    if (!promiseForm.promiseBy) return toast.error('Choose an expected payment date');
    await run(async () => {
      await financeApi.recordPromise(studentId, {
        amount: amount.toFixed(3),
        promiseBy: promiseForm.promiseBy,
        ...(promiseForm.note ? { note: promiseForm.note } : {}),
      });
      setPromiseForm({ amount: '', promiseBy: '', note: '' });
    }, 'Promise to pay recorded');
  }

  async function submitCommunication() {
    if (!commForm.note.trim()) return toast.error('Enter what was discussed');
    await run(async () => {
      await financeApi.logCommunication(studentId, {
        medium: commForm.medium as 'PHONE',
        note: commForm.note.trim(),
      });
      setCommForm({ medium: commForm.medium, note: '' });
    }, 'Communication logged');
  }

  async function sendReminder(level: string) {
    setBusy(true);
    try {
      const r = await financeApi.remind(studentId, ['IN_APP', 'EMAIL'], level || undefined);
      const reached = r.recipients + r.emailsSent;
      if (reached === 0) {
        toast.error(
          'No reminder delivered — the parent has no app account or email on file. Add a parent email, or log a call in the Communication Log.',
        );
      } else {
        toast.success(
          `Reminder sent (${r.recipients} in-app, ${r.emailsSent} email${
            r.emailsSent === 1 ? '' : 's'
          }).`,
        );
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send the reminder');
    } finally {
      setBusy(false);
    }
  }

  async function suspendTransport() {
    const reason = window.prompt('Reason for suspending transport?');
    if (!reason || !reason.trim()) return;
    await run(() => financeApi.suspendTransport(studentId, reason.trim()), 'Transport suspended');
  }

  async function reinstateTransport() {
    await run(() => financeApi.reinstateTransport(studentId), 'Transport reinstated');
  }

  async function downloadReceipt(paymentId: string) {
    try {
      const doc = await documentsApi.generate({ type: 'PAYMENT_RECEIPT', studentId, paymentId });
      await documentsApi.download(doc.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate the receipt');
    }
  }

  if (loading) return <Spinner />;
  if (error) return <EmptyState title="Finance unavailable" description={error} />;
  if (!statement || !totals) return <EmptyState title="No financial account" />;

  return (
    <div className="flex flex-col gap-6">
      {/* Preview notice — transactions happen at the account level in the Finance module. */}
      {readOnly && (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Preview only. Record payments and manage this account in the{' '}
          <span className="font-medium text-foreground">Finance</span> module — one account pays for
          all its students.
        </div>
      )}

      {/* ── Student Financial Account header ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Student Financial Account</CardTitle>
          <div className="flex items-center gap-2">
            <FeeModifiedBadge
              feeModified={collections?.feeModified ?? false}
              customArrangement={collections?.customArrangement ?? false}
            />
            {collections && collections.collectionsStatus !== 'NONE' && (
              <Badge tone={collections.collectionsStatus === 'LEGAL' ? 'danger' : 'warning'}>
                {collections.collectionsStatus === 'LEGAL'
                  ? 'Legal Collections'
                  : 'Financial Issue'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Stat
              label="Outstanding"
              value={num(totals.outstanding)}
              tone={Number(totals.outstanding) > 0 ? 'text-accent-warm' : ''}
            />
            <Stat label="Paid" value={num(totals.paid)} />
            <Stat label="Discounts" value={num(totals.discounts)} />
            <Stat label="Credits" value={num(totals.creditBalance)} />
            <Stat label="Refunded" value={num(totals.refunded)} />
          </div>
        </CardContent>
      </Card>

      {/* ── Collections workspace: overdue snapshot · promises · communication ── */}
      {collections && (
        <CollectionsPanel
          profile={collections}
          busy={busy}
          readOnly={readOnly}
          promiseForm={promiseForm}
          setPromiseForm={setPromiseForm}
          commForm={commForm}
          setCommForm={setCommForm}
          onRecordPromise={() => void submitPromise()}
          onResolvePromise={(id, kept) =>
            void run(() => financeApi.resolvePromise(id, kept), 'Promise updated')
          }
          onLogCommunication={() => void submitCommunication()}
          onSendReminder={(level) => void sendReminder(level)}
          onSuspendTransport={() => void suspendTransport()}
          onReinstateTransport={() => void reinstateTransport()}
        />
      )}

      {/* ── Charges → Plans → Installments hierarchy ── */}
      <Card>
        <CardHeader>
          <CardTitle>Charges</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {activeCharges.length === 0 && (
            <EmptyState title="No charges" description="This student has no charges yet." />
          )}
          {activeCharges.map((cv) => (
            <ChargeNode
              key={cv.charge.id}
              cv={cv}
              open={!!expanded[cv.charge.id]}
              busy={busy}
              readOnly={readOnly}
              onToggle={() => setExpanded((p) => ({ ...p, [cv.charge.id]: !p[cv.charge.id] }))}
              onPlan={() =>
                setPlanForm({
                  chargeId: cv.charge.id,
                  cadence: 'MONTHLY',
                  installments: '9',
                  firstDueDate: '',
                  reason: '',
                  isReplace: !!cv.plan,
                })
              }
              onDiscount={() =>
                setAdjForm({ chargeId: cv.charge.id, type: 'DISCOUNT', amount: '', reason: '' })
              }
              onPay={() => void payCharge(cv)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Create-plan inline form */}
      {!readOnly && planForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {planForm.isReplace ? 'Renegotiate payment plan' : 'Create payment plan'}
            </CardTitle>
          </CardHeader>
          {planForm.isReplace && (
            <div className="mx-4 mb-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
              Exceptional action. The current plan is superseded (kept for history) and a new plan
              is generated for the <strong>outstanding balance only</strong>. Paid installments,
              allocations and credits are preserved. A reason is required and recorded in the audit
              log.
            </div>
          )}
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Field label="Cadence">
              <Select
                value={planForm.cadence}
                onChange={(e) => setPlanForm({ ...planForm, cadence: e.target.value })}
              >
                {CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Installments">
              <Input
                type="number"
                min={1}
                value={planForm.installments}
                onChange={(e) => setPlanForm({ ...planForm, installments: e.target.value })}
              />
            </Field>
            <Field label="First due date">
              <DatePicker
                value={planForm.firstDueDate}
                onChange={(value) => setPlanForm({ ...planForm, firstDueDate: value })}
              />
            </Field>
            {planForm.isReplace && (
              <Field label="Reason (required)" className="sm:col-span-4">
                <Input
                  placeholder="e.g. financial hardship, scholarship, recalculation, transfer, correction"
                  value={planForm.reason}
                  onChange={(e) => setPlanForm({ ...planForm, reason: e.target.value })}
                />
              </Field>
            )}
            <div className="flex items-end gap-2">
              <Button
                variant={planForm.isReplace ? 'destructive' : 'default'}
                onClick={() => void submitPlan()}
                disabled={busy}
              >
                {planForm.isReplace ? 'Renegotiate plan' : 'Create plan'}
              </Button>
              <Button variant="ghost" onClick={() => setPlanForm(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Apply-adjustment inline form */}
      {!readOnly && adjForm && (
        <Card>
          <CardHeader>
            <CardTitle>Apply adjustment</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Field label="Type">
              <Select
                value={adjForm.type}
                onChange={(e) => setAdjForm({ ...adjForm, type: e.target.value })}
              >
                {ADJUSTMENT_TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {ty.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Amount (JOD)">
              <Input
                type="number"
                value={adjForm.amount}
                onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })}
              />
            </Field>
            <Field label="Reason">
              <Input
                value={adjForm.reason}
                onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
              />
            </Field>
            <div className="flex items-end gap-2">
              <Button onClick={() => void submitAdjustment()} disabled={busy}>
                Apply
              </Button>
              <Button variant="ghost" onClick={() => setAdjForm(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Record payment (account-level only; hidden in preview) ── */}
      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle>Record payment</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Field label="Amount (JOD)">
              <Input
                type="number"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
              />
            </Field>
            <Field label="Method">
              <Select
                value={payForm.method}
                onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reference">
              <Input
                value={payForm.reference}
                onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
              />
            </Field>
            <div className="flex items-end">
              <Button onClick={() => void submitPayment()} disabled={busy}>
                Record &amp; verify
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Payments ── */}
      <SectionTable title="Payments">
        {statement.payments.length === 0 ? (
          <EmptyState title="No payments" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Receipt</TH>
                <TH>Date</TH>
                <TH>Method</TH>
                <TH>Amount</TH>
                <TH>Status</TH>
                <TH>Invoice</TH>
                <TH> </TH>
              </TR>
            </THead>
            <TBody>
              {statement.payments.map((p) => (
                <TR key={p.id}>
                  <TD>{p.receiptNo != null ? receiptLabel(p.receiptNo) : '—'}</TD>
                  <TD>{dateStr(p.createdAt)}</TD>
                  <TD>{p.method}</TD>
                  <TD>{num(p.amount)}</TD>
                  <TD>
                    <TransactionStatusBadge status={p.status} />
                  </TD>
                  <TD>{p.einvoice ? p.einvoice.invoiceNumber : '—'}</TD>
                  <TD className="flex gap-2">
                    {!readOnly && p.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            void run(() => financeApi.verify(p.id), 'Payment verified')
                          }
                          disabled={busy}
                        >
                          Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            void run(() => financeApi.reject(p.id), 'Payment rejected')
                          }
                          disabled={busy}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {p.status === 'VERIFIED' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void downloadReceipt(p.id)}
                        >
                          Receipt
                        </Button>
                        {!readOnly && !p.parentNotifiedAt && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void run(() => financeApi.notifyParent(p.id), 'Parent notified')
                            }
                            disabled={busy}
                          >
                            Notify parent
                          </Button>
                        )}
                      </>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </SectionTable>

      {/* ── Credits ── */}
      {statement.credits.length > 0 && (
        <SectionTable title="Credits">
          <Table>
            <THead>
              <TR>
                <TH>Source</TH>
                <TH>Amount</TH>
                <TH>Remaining</TH>
                <TH>Created</TH>
              </TR>
            </THead>
            <TBody>
              {statement.credits.map((c) => (
                <TR key={c.id}>
                  <TD>{c.source.replace(/_/g, ' ')}</TD>
                  <TD>{num(c.amount)}</TD>
                  <TD>{num(c.remaining)}</TD>
                  <TD>{dateStr(c.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </SectionTable>
      )}

      {/* ── Refunds ── */}
      <SectionTable
        title="Refunds"
        action={
          readOnly ? undefined : (
            <div className="flex items-end gap-2">
              <Input
                className="w-28"
                type="number"
                placeholder="Amount"
                value={refundForm.amount}
                onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
              />
              <Input
                className="w-40"
                placeholder="Reason"
                value={refundForm.reason}
                onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
              />
              <Button size="sm" onClick={() => void submitRefund()} disabled={busy}>
                Refund credit
              </Button>
            </div>
          )
        }
      >
        {statement.refunds.length === 0 ? (
          <EmptyState title="No refunds" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Amount</TH>
                <TH>Method</TH>
                <TH>Reason</TH>
                <TH>Status</TH>
                <TH> </TH>
              </TR>
            </THead>
            <TBody>
              {statement.refunds.map((r) => (
                <TR key={r.id}>
                  <TD>{dateStr(r.createdAt)}</TD>
                  <TD>{num(r.amount)}</TD>
                  <TD>{r.method}</TD>
                  <TD>{r.reason}</TD>
                  <TD>
                    <TransactionStatusBadge status={r.status} />
                  </TD>
                  <TD>
                    {!readOnly && r.status === 'PENDING' && (
                      <Button
                        size="sm"
                        onClick={() =>
                          void run(() => financeApi.verifyRefund(r.id), 'Refund verified')
                        }
                        disabled={busy}
                      >
                        Verify
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </SectionTable>

      {/* ── Adjustments ── */}
      {statement.adjustments.length > 0 && (
        <SectionTable title="Adjustments">
          <Table>
            <THead>
              <TR>
                <TH>Type</TH>
                <TH>Amount</TH>
                <TH>Reason</TH>
                <TH>Status</TH>
                <TH> </TH>
              </TR>
            </THead>
            <TBody>
              {statement.adjustments.map((a) => (
                <TR key={a.id}>
                  <TD>{a.type.replace(/_/g, ' ')}</TD>
                  <TD>{num(a.amount)}</TD>
                  <TD>{a.reason}</TD>
                  <TD>
                    <Badge tone={a.status === 'APPLIED' ? 'success' : 'muted'}>{a.status}</Badge>
                  </TD>
                  <TD>
                    {!readOnly && a.status === 'APPLIED' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void run(() => financeApi.reverseAdjustment(a.id), 'Adjustment reversed')
                        }
                        disabled={busy}
                      >
                        Reverse
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </SectionTable>
      )}

      {/* ── Documents ── */}
      <DocumentsSection studentId={studentId} />
    </div>
  );
}

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-lg font-semibold ${tone}`}>{value}</span>
    </div>
  );
}

function SectionTable({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * Collections workspace — the operational surface a finance officer works in daily: the overdue
 * snapshot, transport status, promises-to-pay (record + resolve) and the communication log. The
 * primary actions are collect / promise / remind / log — NOT replacing the plan.
 */
function CollectionsPanel({
  profile,
  busy,
  readOnly,
  promiseForm,
  setPromiseForm,
  commForm,
  setCommForm,
  onRecordPromise,
  onResolvePromise,
  onLogCommunication,
  onSendReminder,
  onSuspendTransport,
  onReinstateTransport,
}: {
  profile: CollectionsProfile;
  busy: boolean;
  readOnly: boolean;
  promiseForm: { amount: string; promiseBy: string; note: string };
  setPromiseForm: (v: { amount: string; promiseBy: string; note: string }) => void;
  commForm: { medium: string; note: string };
  setCommForm: (v: { medium: string; note: string }) => void;
  onRecordPromise: () => void;
  onResolvePromise: (id: string, kept: boolean) => void;
  onLogCommunication: () => void;
  onSendReminder: (level: string) => void;
  onSuspendTransport: () => void;
  onReinstateTransport: () => void;
}) {
  const s = profile.snapshot;
  const overdue = Number(s.overdue) > 0;
  const [level, setLevel] = useState('');
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Collections</CardTitle>
        <div className="flex items-center gap-2">
          {profile.transportSuspended && <Badge tone="danger">Transport suspended</Badge>}
          {!readOnly && (
            <>
              <Select value={level} onChange={(e) => setLevel(e.target.value)} disabled={busy}>
                {REMINDER_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSendReminder(level)}
                disabled={busy}
              >
                Send reminder
              </Button>
              {profile.transportSuspended ? (
                <Button size="sm" variant="ghost" onClick={onReinstateTransport} disabled={busy}>
                  Reinstate transport
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={onSuspendTransport} disabled={busy}>
                  Suspend transport
                </Button>
              )}
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Overdue snapshot — the numbers the officer works from. */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Stat label="Outstanding" value={num(s.outstanding)} />
          <Stat label="Overdue" value={num(s.overdue)} tone={overdue ? 'text-accent-warm' : ''} />
          <Stat label="Overdue items" value={String(s.overdueCount)} />
          <Stat
            label="Oldest overdue"
            value={s.oldestOverdueDays ? `${s.oldestOverdueDays}d` : '—'}
          />
          <Stat label="Due this month" value={num(s.dueThisMonth)} />
        </div>

        {/* Transport status detail. */}
        {(profile.transportSuspended || profile.transportReinstatedAt) && (
          <div className="rounded-md border border-border px-3 py-2 text-sm">
            {profile.transportSuspended ? (
              <span>
                <span className="font-medium text-accent-warm">Transport suspended</span>
                {profile.transportSuspendedAt ? ` on ${dateStr(profile.transportSuspendedAt)}` : ''}
                {profile.transportSuspendedReason ? ` — ${profile.transportSuspendedReason}` : ''}
              </span>
            ) : (
              <span className="text-muted-foreground">
                Transport active. Last reinstated {dateStr(profile.transportReinstatedAt)}.
              </span>
            )}
          </div>
        )}

        {/* Promise to Pay — prominent. */}
        <div>
          <div className="mb-2 text-sm font-medium">Promise to pay</div>
          {!readOnly && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Field label="Amount">
                <Input
                  type="number"
                  min={0}
                  placeholder="0.000"
                  value={promiseForm.amount}
                  onChange={(e) => setPromiseForm({ ...promiseForm, amount: e.target.value })}
                />
              </Field>
              <Field label="Expected date">
                <DatePicker
                  value={promiseForm.promiseBy}
                  onChange={(value) => setPromiseForm({ ...promiseForm, promiseBy: value })}
                />
              </Field>
              <Field label="Note" className="sm:col-span-1">
                <Input
                  placeholder="optional"
                  value={promiseForm.note}
                  onChange={(e) => setPromiseForm({ ...promiseForm, note: e.target.value })}
                />
              </Field>
              <div className="flex items-end">
                <Button onClick={onRecordPromise} disabled={busy}>
                  Record promise
                </Button>
              </div>
            </div>
          )}
          {profile.promises.length > 0 && (
            <Table>
              <THead>
                <TR>
                  <TH>Amount</TH>
                  <TH>By</TH>
                  <TH>Note</TH>
                  <TH>Status</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {profile.promises.map((p) => (
                  <TR key={p.id}>
                    <TD>{num(p.amount)}</TD>
                    <TD>{dateStr(p.promiseBy)}</TD>
                    <TD>{p.note ?? '—'}</TD>
                    <TD>
                      <Badge tone={promiseTone(p.status)}>{p.status}</Badge>
                    </TD>
                    <TD>
                      {!readOnly && (p.status === 'OPEN' || p.status === 'OVERDUE') && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onResolvePromise(p.id, true)}
                            disabled={busy}
                          >
                            Kept
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onResolvePromise(p.id, false)}
                            disabled={busy}
                          >
                            Broken
                          </Button>
                        </div>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>

        {/* Communication log. */}
        <div>
          <div className="mb-2 text-sm font-medium">Communication log</div>
          {!readOnly && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Field label="Medium">
                <Select
                  value={commForm.medium}
                  onChange={(e) => setCommForm({ ...commForm, medium: e.target.value })}
                >
                  {COMM_MEDIUMS.map((m) => (
                    <option key={m} value={m}>
                      {mediumLabel[m]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="What was discussed" className="sm:col-span-2">
                <Input
                  placeholder="e.g. Called father — will pay 2 installments Sunday"
                  value={commForm.note}
                  onChange={(e) => setCommForm({ ...commForm, note: e.target.value })}
                />
              </Field>
              <div className="flex items-end">
                <Button onClick={onLogCommunication} disabled={busy}>
                  Log contact
                </Button>
              </div>
            </div>
          )}
          {profile.communications.length > 0 && (
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Medium</TH>
                  <TH>Note</TH>
                </TR>
              </THead>
              <TBody>
                {profile.communications.map((c) => (
                  <TR key={c.id}>
                    <TD>{dateStr(c.createdAt)}</TD>
                    <TD>{c.medium ? mediumLabel[c.medium] : '—'}</TD>
                    <TD>{c.detail ?? '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** A single charge (obligation) node: header + expandable plan/installments. */
function ChargeNode({
  cv,
  open,
  busy,
  readOnly,
  onToggle,
  onPlan,
  onDiscount,
  onPay,
}: {
  cv: ChargeView;
  open: boolean;
  busy: boolean;
  readOnly: boolean;
  onToggle: () => void;
  onPlan: () => void;
  onDiscount: () => void;
  onPay: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const history = cv.history ?? [];
  // The one-time registration fee is paid in full when the student registers — it is never put on a
  // payment plan, so it gets a "Pay" action instead of the installment/plan controls.
  const isRegistrationFee = cv.charge.description === 'Registration fee';
  const outstanding = Number(cv.balance) > 0;
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{open ? '▼' : '▶'}</span>
          <span className="font-medium">{cv.charge.description}</span>
          <ChargeStatusBadge status={cv.charge.status} />
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">Net {num(cv.net)}</span>
          <span
            className={Number(cv.balance) > 0 ? 'font-semibold text-accent-warm' : 'font-semibold'}
          >
            Out {num(cv.balance)}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3">
          {/* Fee-line breakdown for an aggregate charge: the details, then the sum. */}
          {cv.lineItems && cv.lineItems.length > 0 && (
            <div className="mb-3">
              <div className="mb-2 text-sm font-medium">Fee breakdown</div>
              <Table>
                <THead>
                  <TR>
                    <TH>Fee</TH>
                    <TH>Amount</TH>
                  </TR>
                </THead>
                <TBody>
                  {cv.lineItems.map((li, i) => (
                    <TR key={`${li.label}-${i}`}>
                      <TD>{li.label}</TD>
                      <TD>{num(li.amount)}</TD>
                    </TR>
                  ))}
                  <TR>
                    <TD className="font-semibold">Total</TD>
                    <TD className="font-semibold">{num(cv.gross)}</TD>
                  </TR>
                </TBody>
              </Table>
            </div>
          )}

          <div className="mb-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Gross" value={num(cv.gross)} />
            <Stat label="Discount" value={num(cv.discount)} />
            <Stat label="Net" value={num(cv.net)} />
            <Stat label="Paid" value={num(cv.paid)} />
          </div>

          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">
              {isRegistrationFee
                ? 'One-time registration fee'
                : cv.plan
                  ? `Payment Plan · ${cv.plan.cadence} × ${cv.plan.installments}`
                  : 'No payment plan'}
            </span>
            {!readOnly && (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={onDiscount} disabled={busy}>
                  Adjust
                </Button>
                {/* The registration fee is paid once, in full — a single "Pay" action, never a plan. */}
                {isRegistrationFee
                  ? outstanding && (
                      <Button size="sm" onClick={onPay} disabled={busy}>
                        Pay
                      </Button>
                    )
                  : // Creating the first plan is a normal action; REPLACING an existing plan is an
                    // exceptional admin action moved under Advanced actions below.
                    !cv.plan && (
                      <Button size="sm" variant="ghost" onClick={onPlan} disabled={busy}>
                        Create plan
                      </Button>
                    )}
              </div>
            )}
          </div>

          {isRegistrationFee ? (
            <div className="text-sm text-muted-foreground">
              {outstanding
                ? `Due ${dateStr(cv.installments[0]?.dueDate)} · ${num(cv.balance)} outstanding.`
                : 'Paid in full.'}
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>#</TH>
                  <TH>Due</TH>
                  <TH>Amount</TH>
                  <TH>Paid</TH>
                  <TH>Balance</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {cv.installments.map((inst) => (
                  <TR key={inst.id}>
                    <TD>{inst.seq}</TD>
                    <TD>{dateStr(inst.dueDate)}</TD>
                    <TD>{num(inst.amount)}</TD>
                    <TD>{num(inst.paid)}</TD>
                    <TD>{num(inst.balance)}</TD>
                    <TD>
                      <Badge tone={installmentTone(inst)}>
                        {inst.overdue ? 'OVERDUE' : inst.status}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}

          {history.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="text-sm font-medium text-muted-foreground"
              >
                {showHistory ? '▼' : '▶'} Plan history ({history.length} superseded)
              </button>
              {showHistory &&
                history.map((h) => (
                  <div key={h.id} className="mt-3">
                    <div className="mb-1 flex items-center gap-2 text-sm">
                      <Badge tone="muted">{h.status}</Badge>
                      <span className="text-muted-foreground">
                        {h.cadence} × {h.count} · paid {num(h.paid)} of {num(h.scheduled)}
                      </span>
                    </div>
                    <Table>
                      <THead>
                        <TR>
                          <TH>#</TH>
                          <TH>Due</TH>
                          <TH>Amount</TH>
                          <TH>Paid</TH>
                          <TH>Balance</TH>
                          <TH>Status</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {h.lines.map((inst) => (
                          <TR key={inst.id}>
                            <TD>{inst.seq}</TD>
                            <TD>{dateStr(inst.dueDate)}</TD>
                            <TD>{num(inst.amount)}</TD>
                            <TD>{num(inst.paid)}</TD>
                            <TD>{num(inst.balance)}</TD>
                            <TD>
                              <Badge tone={installmentTone(inst)}>{inst.status}</Badge>
                            </TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                ))}
            </div>
          )}

          {/* Advanced actions — exceptional, not part of the daily collection workflow. */}
          {!readOnly && cv.plan && (
            <div className="mt-4 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-sm font-medium text-muted-foreground"
              >
                {showAdvanced ? '▼' : '▶'} Advanced actions
              </button>
              {showAdvanced && (
                <div className="mt-2 flex items-center gap-3">
                  <Button size="sm" variant="ghost" onClick={onPlan} disabled={busy}>
                    Renegotiate payment plan
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Supersedes the current plan and re-schedules the outstanding balance. Requires a
                    reason (hardship, scholarship, recalculation, transfer, correction).
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

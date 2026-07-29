'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@axa/platform';
import { financeApi, type AgingReport, type PushOutstandingInput } from '@/lib/finance';

const jod = (v: string | number) => `${Number(v).toFixed(3)} JOD`;

/**
 * Collections dashboard (Phases 5–6): aging of outstanding balances by 30/60/90-day buckets,
 * collection effectiveness, and a one-click transport-suspension sweep (suspend overdue accounts,
 * restore the ones that have caught up) driven by the tenant billing policy.
 */
export default function CollectionsPage() {
  const toast = useToast();
  const [report, setReport] = useState<AgingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setReport(await financeApi.aging());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load aging report');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSweep() {
    setSweeping(true);
    try {
      const r = await financeApi.evaluateTransportAll();
      toast.success(`Evaluated ${r.evaluated} — suspended ${r.suspended}, restored ${r.restored}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transport sweep failed');
    } finally {
      setSweeping(false);
    }
  }

  const t = report?.totals;

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-semibold">Collections</h1>
            <p className="text-sm text-muted-foreground">
              Outstanding balances by age, collection effectiveness, and transport suspension.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setPushOpen(true)}>Push outstanding</Button>
            <Button variant="outline" onClick={() => void runSweep()} disabled={sweeping}>
              {sweeping ? 'Running…' : 'Run transport sweep'}
            </Button>
          </div>
        </header>

        <PushOutstandingDialog
          open={pushOpen}
          onClose={() => setPushOpen(false)}
          onSent={() => void load()}
        />

        {report ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Total outstanding" value={jod(t!.total)} />
            <Stat label="Overdue 90+ days" value={jod(t!.d90plus)} tone="text-warning" />
            <Stat label="Collected" value={`${report.collectedPct}%`} tone="text-success" />
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Aging by account</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !report || report.rows.length === 0 ? (
              <EmptyState title="No outstanding balances" />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Student</TH>
                    <TH className="text-end">Current</TH>
                    <TH className="text-end">1–30</TH>
                    <TH className="text-end">31–60</TH>
                    <TH className="text-end">61–90</TH>
                    <TH className="text-end">90+</TH>
                    <TH className="text-end">Total</TH>
                  </TR>
                </THead>
                <TBody>
                  {report.rows.map((r) => (
                    <TR key={r.studentId}>
                      <TD className="text-sm">{r.studentName ?? r.studentId.slice(0, 8)}</TD>
                      <TD className="text-end font-mono">{Number(r.current).toFixed(3)}</TD>
                      <TD className="text-end font-mono">{Number(r.d1_30).toFixed(3)}</TD>
                      <TD className="text-end font-mono">{Number(r.d31_60).toFixed(3)}</TD>
                      <TD className="text-end font-mono">{Number(r.d61_90).toFixed(3)}</TD>
                      <TD className="text-end font-mono text-warning">
                        {Number(r.d90plus).toFixed(3)}
                      </TD>
                      <TD className="text-end font-mono font-semibold">
                        {Number(r.total).toFixed(3)}
                      </TD>
                    </TR>
                  ))}
                  {t ? (
                    <TR>
                      <TD className="font-semibold">Total</TD>
                      <TD className="text-end font-mono font-semibold">
                        {Number(t.current).toFixed(3)}
                      </TD>
                      <TD className="text-end font-mono font-semibold">
                        {Number(t.d1_30).toFixed(3)}
                      </TD>
                      <TD className="text-end font-mono font-semibold">
                        {Number(t.d31_60).toFixed(3)}
                      </TD>
                      <TD className="text-end font-mono font-semibold">
                        {Number(t.d61_90).toFixed(3)}
                      </TD>
                      <TD className="text-end font-mono font-semibold">
                        {Number(t.d90plus).toFixed(3)}
                      </TD>
                      <TD className="text-end font-mono font-semibold">
                        {Number(t.total).toFixed(3)}
                      </TD>
                    </TR>
                  ) : null}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={`font-display text-2xl font-semibold ${tone ?? ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Filtered push of outstanding balances to parents (FCM push via the notification engine).
 * Narrow by overdue age (>30/60/90 days) and/or a minimum amount; when both are set, choose
 * whether an account must match both (ALL) or either (ANY).
 */
function PushOutstandingDialog({
  open,
  onClose,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const toast = useToast();
  const [ageDays, setAgeDays] = useState<'' | '30' | '60' | '90'>('');
  const [minAmount, setMinAmount] = useState('');
  const [match, setMatch] = useState<'ALL' | 'ANY'>('ALL');
  const [mandatory, setMandatory] = useState(false);
  const [alsoEmail, setAlsoEmail] = useState(true);
  const [sending, setSending] = useState(false);

  const hasAge = ageDays !== '';
  const hasAmount = minAmount.trim() !== '';
  const bothFilters = hasAge && hasAmount;

  function reset() {
    setAgeDays('');
    setMinAmount('');
    setMatch('ALL');
    setMandatory(false);
    setAlsoEmail(true);
  }

  async function submit() {
    if (hasAmount && !(Number(minAmount) > 0)) {
      toast.error('Minimum amount must be a positive number');
      return;
    }
    const payload: PushOutstandingInput = {};
    if (hasAge) payload.minAgeDays = Number(ageDays) as 30 | 60 | 90;
    if (hasAmount) payload.minAmount = Number(minAmount).toFixed(3);
    if (bothFilters) payload.match = match;
    if (mandatory) payload.mandatory = true;
    payload.email = alsoEmail;

    setSending(true);
    try {
      const r = await financeApi.pushOutstanding(payload);
      toast.success(
        `Pushed to ${r.pushed} account(s) — ${r.totalRecipients} parent(s)` +
          (r.totalEmails ? `, ${r.totalEmails} email(s)` : '') +
          (r.skippedLegal ? `, ${r.skippedLegal} skipped (legal)` : '') +
          (r.skippedNoParent ? `, ${r.skippedNoParent} without a parent contact` : '') +
          '.',
      );
      reset();
      onClose();
      onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to push outstanding balances');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Push outstanding balances"
      description="Notify parents of the outstanding balance by push and (optionally) email. Use the filters to target overdue or high-value accounts. Students in legal collections are always excluded."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={sending}>
            {sending ? 'Sending…' : 'Send notice'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Overdue age" htmlFor="push-age" hint="Only balances overdue beyond this age">
          <Select
            id="push-age"
            value={ageDays}
            onChange={(e) => setAgeDays(e.target.value as '' | '30' | '60' | '90')}
          >
            <option value="">Any age (all outstanding)</option>
            <option value="30">More than 30 days</option>
            <option value="60">More than 60 days</option>
            <option value="90">More than 90 days</option>
          </Select>
        </Field>

        <Field
          label="Minimum amount (JOD)"
          htmlFor="push-amount"
          hint="Only accounts whose total outstanding is at least this amount"
        >
          <Input
            id="push-amount"
            type="number"
            min="0"
            step="0.001"
            inputMode="decimal"
            placeholder="e.g. 100.000"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
          />
        </Field>

        {bothFilters ? (
          <Field label="Combine filters" htmlFor="push-match">
            <Select
              id="push-match"
              value={match}
              onChange={(e) => setMatch(e.target.value as 'ALL' | 'ANY')}
            >
              <option value="ALL">Match both (age and amount)</option>
              <option value="ANY">Match either (age or amount)</option>
            </Select>
          </Field>
        ) : null}

        <Checkbox
          checked={alsoEmail}
          onChange={(e) => setAlsoEmail(e.target.checked)}
          label="Also email the assigned parent(s) at their email on file"
        />

        <Checkbox
          checked={mandatory}
          onChange={(e) => setMandatory(e.target.checked)}
          label="Ignore parents’ notification preferences (school-enforced notice)"
        />
      </div>
    </Dialog>
  );
}

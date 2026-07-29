'use client';

import { useMemo, useState } from 'react';
import { useDemo } from '@/lib/demo-store/context';
import { useSession } from '@/lib/session-context';
import { financeSummary, studentName } from '@/lib/demo-store/selectors';
import { jod, pct, fmtDate } from '@/lib/format';
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
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@axa/platform';
import { PageHeader, Gate, Kpi } from '@/components/page';
import type { Invoice, InvoiceStatus, PaymentMethod } from '@/seed/types';

const STATUS_TONE: Record<InvoiceStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  PAID: 'success',
  PARTIAL: 'warning',
  OVERDUE: 'danger',
  PENDING: 'default',
};
const METHODS: PaymentMethod[] = ['CASH', 'CLIQ', 'CARD', 'BANK_TRANSFER', 'CHEQUE'];

export default function FinancePage() {
  return (
    <Gate perm="finance:read">
      <Finance />
    </Gate>
  );
}

function Finance() {
  const { data, actions } = useDemo();
  const { can } = useSession();
  const toast = useToast();
  const canManage = can('finance:manage');

  const [status, setStatus] = useState<'' | InvoiceStatus>('');
  const [query, setQuery] = useState('');
  const [payFor, setPayFor] = useState<Invoice | null>(null);
  const [showNew, setShowNew] = useState(false);

  const summary = financeSummary(data);
  const nameOf = (sid: string) => {
    const s = data.students.find((st) => st.id === sid);
    return s ? studentName(s) : '—';
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.invoices
      .filter((i) => (status ? i.status === status : true))
      .filter((i) =>
        q
          ? nameOf(i.studentId).toLowerCase().includes(q) || i.number.toLowerCase().includes(q)
          : true,
      )
      .slice(0, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.invoices, status, query]);

  function reissueStatus(inv: Invoice, paid: number): InvoiceStatus {
    if (paid >= inv.amount) return 'PAID';
    if (paid > 0) return new Date(inv.dueDate) < new Date() ? 'OVERDUE' : 'PARTIAL';
    return inv.status;
  }

  function recordPayment(inv: Invoice, amount: number, method: PaymentMethod) {
    const paid = Math.min(inv.amount, inv.paid + amount);
    actions.recordPayment(inv.id, inv.studentId, amount, method);
    actions.updateInvoice(inv.id, { paid, status: reissueStatus(inv, paid) });
    actions.mockSend('PAYMENT', method, `Payment ${jod(amount)} for ${inv.number}`);
    toast.success(`Recorded ${jod(amount)} against ${inv.number} (demo only).`);
    setPayFor(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Finance"
        subtitle="Tuition invoices, payments and outstanding balances."
        actions={
          canManage ? <Button onClick={() => setShowNew(true)}>New invoice</Button> : undefined
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Billed" value={jod(summary.billed)} />
        <Kpi label="Collected" value={jod(summary.collected)} tone="cool" />
        <Kpi label="Outstanding" value={jod(summary.outstanding)} tone="warm" />
        <Kpi label="Overdue" value={jod(summary.overdue)} tone="warm" />
        <Kpi label="Collection rate" value={pct(summary.collectionRate)} tone="cool" />
      </section>

      <div className="flex flex-wrap items-end gap-2">
        <Field label="Search" className="flex-1">
          <Input
            value={query}
            placeholder="Student or invoice number…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as '' | InvoiceStatus)}>
            <option value="">All</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="PENDING">Pending</option>
            <option value="OVERDUE">Overdue</option>
          </Select>
        </Field>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Invoice</TH>
                <TH>Student</TH>
                <TH>Description</TH>
                <TH className="text-end">Amount</TH>
                <TH className="text-end">Balance</TH>
                <TH>Due</TH>
                <TH>Status</TH>
                {canManage ? <TH className="text-end">Actions</TH> : null}
              </TR>
            </THead>
            <TBody>
              {filtered.map((inv) => {
                const balance = inv.amount - inv.paid;
                return (
                  <TR key={inv.id}>
                    <TD className="font-mono text-xs">{inv.number}</TD>
                    <TD>{nameOf(inv.studentId)}</TD>
                    <TD>{inv.descriptionEn}</TD>
                    <TD className="text-end font-mono">{inv.amount.toFixed(3)}</TD>
                    <TD className="text-end font-mono text-accent-warm">{balance.toFixed(3)}</TD>
                    <TD className="font-mono text-xs">{fmtDate(inv.dueDate)}</TD>
                    <TD>
                      <Badge tone={STATUS_TONE[inv.status]}>{inv.status}</Badge>
                    </TD>
                    {canManage ? (
                      <TD className="text-end">
                        <span className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={balance <= 0}
                            onClick={() => setPayFor(inv)}
                          >
                            Pay
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              actions.mockSend(
                                'JOFOTARA',
                                inv.number,
                                `Issue e-invoice for ${inv.number}`,
                              );
                              toast.success(
                                `e-Invoice issued for ${inv.number} (mocked — not submitted).`,
                              );
                            }}
                          >
                            e-Invoice
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={balance <= 0}
                            onClick={() => {
                              actions.mockSend(
                                'SMS',
                                nameOf(inv.studentId),
                                `Fee reminder for ${inv.number}`,
                              );
                              toast.success('Reminder sent (mocked — no real SMS).');
                            }}
                          >
                            Remind
                          </Button>
                        </span>
                      </TD>
                    ) : null}
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {payFor ? (
        <PaymentDialog invoice={payFor} onClose={() => setPayFor(null)} onPay={recordPayment} />
      ) : null}
      {showNew ? <NewInvoiceDialog onClose={() => setShowNew(false)} /> : null}
    </div>
  );
}

function PaymentDialog({
  invoice,
  onClose,
  onPay,
}: {
  invoice: Invoice;
  onClose: () => void;
  onPay: (inv: Invoice, amount: number, method: PaymentMethod) => void;
}) {
  const balance = invoice.amount - invoice.paid;
  const [amount, setAmount] = useState(balance.toFixed(3));
  const [method, setMethod] = useState<PaymentMethod>('CLIQ');
  return (
    <Dialog title={`Record payment · ${invoice.number}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = Math.max(0, Math.min(balance, Number(amount)));
          if (value > 0) onPay(invoice, value, method);
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <Field label={`Amount (max ${balance.toFixed(3)})`}>
          <Input
            type="number"
            step="0.001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="font-mono"
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
        <div className="col-span-full flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Record payment</Button>
        </div>
      </form>
    </Dialog>
  );
}

function NewInvoiceDialog({ onClose }: { onClose: () => void }) {
  const { data, actions } = useDemo();
  const toast = useToast();
  const [studentId, setStudentId] = useState(data.students[0]?.id ?? '');
  const [description, setDescription] = useState('Activities Fee');
  const [amount, setAmount] = useState('90.000');

  return (
    <Dialog title="New invoice" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = Number(amount);
          const seq = Math.floor(Math.random() * 90000 + 10000);
          actions.addInvoice({
            number: `INV-2026-${seq}`,
            studentId,
            descriptionEn: description,
            descriptionAr: description,
            issuedAt: new Date().toISOString().slice(0, 10),
            dueDate: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
            amount: value,
            paid: 0,
            status: 'PENDING',
          });
          toast.success('Invoice created (demo only).');
          onClose();
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <Field label="Student" className="col-span-full">
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {data.students.slice(0, 200).map((s) => (
              <option key={s.id} value={s.id}>
                {studentName(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" className="col-span-full">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
        </Field>
        <Field label="Amount (JOD)">
          <Input
            type="number"
            step="0.001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="font-mono"
            required
          />
        </Field>
        <div className="col-span-full flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create invoice</Button>
        </div>
      </form>
    </Dialog>
  );
}

function Dialog({
  title,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-900/70 p-4 backdrop-blur-xs">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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
  PageHeader,
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
import { platformConsoleApi, type Invoice, type Payment } from '@/lib/platform-console';
import { formatPrice } from '@/lib/subscription';

const INV_TONE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'muted'> = {
  DRAFT: 'muted',
  OPEN: 'warning',
  PAID: 'success',
  VOID: 'muted',
  UNCOLLECTIBLE: 'danger',
  REFUNDED: 'default',
};
const PAY_TONE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'muted'> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  FAILED: 'danger',
  REFUNDED: 'default',
};

export default function SchoolBillingPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const toast = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [inv, setInv] = useState({ number: '', description: '', amount: '' });
  const [pay, setPay] = useState({ amount: '', status: 'COMPLETED', provider: 'MANUAL' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [i, p] = await Promise.all([
        platformConsoleApi.invoices(tenantId),
        platformConsoleApi.payments(tenantId),
      ]);
      setInvoices(i);
      setPayments(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load billing');
    } finally {
      setLoading(false);
    }
  }, [tenantId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    try {
      await platformConsoleApi.createInvoice(tenantId, {
        number: inv.number.trim(),
        lines: [
          {
            description: inv.description || 'Subscription',
            quantity: 1,
            unitAmount: Number(inv.amount),
          },
        ],
      });
      toast.success('Invoice created');
      setInv({ number: '', description: '', amount: '' });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    try {
      await platformConsoleApi.recordPayment(tenantId, {
        amount: Number(pay.amount),
        status: pay.status,
        provider: pay.provider,
      });
      toast.success('Payment recorded');
      setPay({ amount: '', status: 'COMPLETED', provider: 'MANUAL' });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function refund(paymentId: string, amount: number) {
    if (!confirm('Refund this payment?')) return;
    try {
      await platformConsoleApi.refund(tenantId, { paymentId, amount });
      toast.success('Refunded');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link
            href={`/platform/console/schools/${tenantId}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← School detail
          </Link>
          <PageHeader title="Billing" className="mt-1" />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Spinner /> Loading…
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>New invoice</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => void createInvoice(e)} className="space-y-2">
                    <Field label="Number">
                      <Input
                        value={inv.number}
                        onChange={(e) => setInv({ ...inv, number: e.target.value })}
                        required
                      />
                    </Field>
                    <Field label="Description">
                      <Input
                        value={inv.description}
                        onChange={(e) => setInv({ ...inv, description: e.target.value })}
                      />
                    </Field>
                    <Field label="Amount (minor units)">
                      <Input
                        type="number"
                        value={inv.amount}
                        onChange={(e) => setInv({ ...inv, amount: e.target.value })}
                        required
                      />
                    </Field>
                    <Button type="submit">Create invoice</Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Record payment</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => void recordPayment(e)} className="space-y-2">
                    <Field label="Amount (minor units)">
                      <Input
                        type="number"
                        value={pay.amount}
                        onChange={(e) => setPay({ ...pay, amount: e.target.value })}
                        required
                      />
                    </Field>
                    <Field label="Status">
                      <Select
                        value={pay.status}
                        onChange={(e) => setPay({ ...pay, status: e.target.value })}
                      >
                        <option value="COMPLETED">Completed</option>
                        <option value="FAILED">Failed</option>
                        <option value="PENDING">Pending</option>
                      </Select>
                    </Field>
                    <Field label="Provider">
                      <Select
                        value={pay.provider}
                        onChange={(e) => setPay({ ...pay, provider: e.target.value })}
                      >
                        <option value="MANUAL">Manual</option>
                        <option value="OFFLINE">Offline</option>
                        <option value="STRIPE">Stripe</option>
                        <option value="MYFATOORAH">MyFatoorah</option>
                      </Select>
                    </Field>
                    <Button type="submit">Record</Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoices.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <THead>
                        <TR>
                          <TH>Number</TH>
                          <TH>Total</TH>
                          <TH>Status</TH>
                          <TH></TH>
                        </TR>
                      </THead>
                      <TBody>
                        {invoices.map((i) => (
                          <TR key={i.id}>
                            <TD className="font-mono text-xs">{i.number}</TD>
                            <TD>{formatPrice(i.total, i.currency)}</TD>
                            <TD>
                              <Badge tone={INV_TONE[i.status] ?? 'muted'}>{i.status}</Badge>
                            </TD>
                            <TD>
                              {i.status === 'DRAFT' ? (
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    void platformConsoleApi.issueInvoice(tenantId, i.id).then(load)
                                  }
                                >
                                  Issue
                                </Button>
                              ) : null}
                            </TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payments &amp; failed payments</CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <THead>
                        <TR>
                          <TH>Amount</TH>
                          <TH>Provider</TH>
                          <TH>Status</TH>
                          <TH>When</TH>
                          <TH></TH>
                        </TR>
                      </THead>
                      <TBody>
                        {payments.map((p) => (
                          <TR key={p.id}>
                            <TD>{formatPrice(p.amount, p.currency)}</TD>
                            <TD>{p.provider}</TD>
                            <TD>
                              <Badge tone={PAY_TONE[p.status] ?? 'muted'}>{p.status}</Badge>
                            </TD>
                            <TD className="text-xs text-muted-foreground">
                              {new Date(p.createdAt).toLocaleDateString()}
                            </TD>
                            <TD>
                              {p.status === 'COMPLETED' ? (
                                <Button
                                  variant="outline"
                                  onClick={() => void refund(p.id, p.amount)}
                                >
                                  Refund
                                </Button>
                              ) : null}
                            </TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Shell>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
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
import {
  einvoicingApi,
  type EInvoiceDashboard,
  type EInvoiceDocument,
  type EInvoiceSettings,
} from '@/lib/einvoicing';

const STATUS_TONE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'muted'> = {
  DRAFT: 'muted',
  QUEUED: 'default',
  SUBMITTING: 'default',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  DEAD_LETTER: 'danger',
  CANCELLED: 'muted',
};

const WIZARD_STEPS = [
  'Enable integration',
  'School information',
  'Device registration',
  'Invoice mapping',
  'Tax configuration',
  'Template',
  'Test submission',
];

/**
 * JoFotara e-invoicing (Admin → Integrations): setup wizard, dashboard widget, and the
 * document queue with manual resubmission. Everything is per-school DB config — the
 * module is inert until the `e_invoicing` feature flag (Modules page) plus the wizard's
 * "enabled" switch are both on.
 */
export default function JoFotaraPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<EInvoiceSettings | null>(null);
  const [dash, setDash] = useState<EInvoiceDashboard | null>(null);
  const [docs, setDocs] = useState<EInvoiceDocument[]>([]);
  const [step, setStep] = useState(0);
  const [flagOff, setFlagOff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cred, setCred] = useState({ clientId: '', secret: '', incomeSourceSequence: '' });

  const load = useCallback(async () => {
    try {
      const s = await einvoicingApi.settings();
      setSettings(s);
      setStep(Math.min(s.completedSteps, WIZARD_STEPS.length - 1));
      const [d, list] = await Promise.all([einvoicingApi.dashboard(), einvoicingApi.documents()]);
      setDash(d);
      setDocs(list);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load';
      if (message.toLowerCase().includes('forbidden') || message.includes('403')) setFlagOff(true);
      else toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(
    data: Parameters<typeof einvoicingApi.updateSettings>[0],
    nextStep?: number,
  ) {
    setBusy(true);
    try {
      const merged = {
        ...data,
        ...(nextStep !== undefined && nextStep > (settings?.completedSteps ?? 0)
          ? { completedSteps: nextStep }
          : {}),
      };
      setSettings(await einvoicingApi.updateSettings(merged));
      if (nextStep !== undefined) setStep(Math.min(nextStep, WIZARD_STEPS.length - 1));
      toast.success('Saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  async function saveCredentials() {
    setBusy(true);
    try {
      await einvoicingApi.saveCredentials({
        clientId: cred.clientId.trim(),
        secret: cred.secret,
        incomeSourceSequence: cred.incomeSourceSequence.trim(),
      });
      setCred({ clientId: '', secret: '', incomeSourceSequence: '' });
      toast.success('Credentials stored (encrypted)');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save credentials');
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    setBusy(true);
    try {
      const r = await einvoicingApi.testConnection();
      if (r.ok) toast.success(r.detail);
      else toast.error(r.detail);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Connection test failed');
    } finally {
      setBusy(false);
    }
  }

  async function testSubmission() {
    setBusy(true);
    try {
      const doc = await einvoicingApi.createInvoice({
        invoiceNumber: `TEST-${Date.now()}`,
        paymentKind: 'RECEIVABLE',
        buyerName: 'Test Guardian | ولي أمر تجريبي',
        buyerIdScheme: 'NIN',
        buyerIdValue: '9900000000',
        lines: [{ name: 'Test fee | رسم تجريبي', quantity: 1, unitPrice: 1 }],
      });
      await einvoicingApi.queue(doc.id);
      const { processed } = await einvoicingApi.runQueue();
      toast.success(`Test invoice processed (${processed} document(s) submitted)`);
      await patch({}, 7);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Test submission failed');
    } finally {
      setBusy(false);
    }
  }

  async function requeue(id: string) {
    try {
      await einvoicingApi.requeue(id);
      await einvoicingApi.runQueue();
      toast.success('Requeued');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to requeue');
    }
  }

  if (loading) {
    return (
      <Shell>
        <Spinner />
      </Shell>
    );
  }

  if (flagOff) {
    return (
      <Shell>
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle>JoFotara e-invoicing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              The e-invoicing module is <strong>disabled</strong> for this school. Enable the
              <strong> e_invoicing</strong> feature flag on the Modules page first — while it is off
              there is no invoice generation, no API calls and no queue processing.
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (!settings) return <Shell>{null}</Shell>;

  const set = settings;

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold">JoFotara e-invoicing</h1>
            <p className="text-sm text-muted-foreground">
              Jordan national e-invoicing (ISTD) — setup wizard, submission queue and archive.
            </p>
          </div>
          <Badge tone={set.enabled ? 'success' : 'muted'}>
            {set.enabled ? `Enabled · ${set.environment}` : 'Disabled'}
          </Badge>
        </div>

        {/* Dashboard widget */}
        {dash ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {[
              ['Today', dash.today],
              ['This month', dash.thisMonth],
              ['Accepted', dash.byStatus.ACCEPTED ?? 0],
              ['Pending', (dash.byStatus.QUEUED ?? 0) + (dash.byStatus.SUBMITTING ?? 0)],
              ['Rejected', dash.byStatus.REJECTED ?? 0],
              ['Dead letter', dash.byStatus.DEAD_LETTER ?? 0],
              ['Drafts', dash.byStatus.DRAFT ?? 0],
            ].map(([label, value]) => (
              <Card key={String(label)}>
                <CardContent className="p-4">
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className="font-display text-2xl font-semibold">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
        {dash?.lastError ? (
          <p className="text-sm text-destructive">Last error: {dash.lastError}</p>
        ) : null}

        {/* Wizard */}
        <Card>
          <CardHeader>
            <CardTitle>Setup wizard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ol className="flex flex-wrap gap-2">
              {WIZARD_STEPS.map((label, i) => (
                <li key={label}>
                  <button
                    type="button"
                    aria-current={step === i ? 'step' : undefined}
                    onClick={() => setStep(i)}
                    className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                      step === i
                        ? 'border-primary-strong bg-primary/10 text-foreground'
                        : i < set.completedSteps
                          ? 'border-transparent bg-muted text-muted-foreground'
                          : 'border-border text-muted-foreground'
                    }`}
                  >
                    {i + 1}. {label}
                    {i < set.completedSteps ? ' ✓' : ''}
                  </button>
                </li>
              ))}
            </ol>

            {step === 0 ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Enable JoFotara">
                    <Select
                      value={set.enabled ? 'on' : 'off'}
                      onChange={(e) => void patch({ enabled: e.target.value === 'on' })}
                    >
                      <option value="off">Disabled</option>
                      <option value="on">Enabled</option>
                    </Select>
                  </Field>
                  <Field label="Environment">
                    <Select
                      value={set.environment}
                      onChange={(e) =>
                        void patch({ environment: e.target.value as 'SIMULATION' | 'PRODUCTION' })
                      }
                    >
                      <option value="SIMULATION">Simulation (no real submissions)</option>
                      <option value="PRODUCTION">Production</option>
                    </Select>
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">
                  JoFotara has no public sandbox — Simulation runs the full pipeline locally and
                  fakes a PASS, so you can configure and train safely before going live.
                </p>
                <Button disabled={busy} onClick={() => void patch({}, 1)}>
                  Continue
                </Button>
              </div>
            ) : null}

            {step === 1 ? (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const text = (k: string): string => {
                    const v = f.get(k);
                    return typeof v === 'string' ? v : '';
                  };
                  void patch(
                    {
                      legalNameEn: text('legalNameEn'),
                      legalNameAr: text('legalNameAr'),
                      taxNumber: text('taxNumber'),
                      vatNumber: text('vatNumber'),
                      commercialRegistration: text('commercialRegistration'),
                      addressLine: text('addressLine'),
                      city: text('city'),
                      phone: text('phone'),
                      email: text('email'),
                    },
                    2,
                  );
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Legal name (EN)">
                    <Input name="legalNameEn" defaultValue={set.legalNameEn ?? ''} required />
                  </Field>
                  <Field label="Legal name (AR)">
                    <Input name="legalNameAr" dir="rtl" defaultValue={set.legalNameAr ?? ''} />
                  </Field>
                  <Field label="Tax number (TIN — digits only)">
                    <Input
                      name="taxNumber"
                      defaultValue={set.taxNumber ?? ''}
                      required
                      pattern="\d+"
                    />
                  </Field>
                  <Field label="VAT number">
                    <Input name="vatNumber" defaultValue={set.vatNumber ?? ''} />
                  </Field>
                  <Field label="Commercial registration">
                    <Input
                      name="commercialRegistration"
                      defaultValue={set.commercialRegistration ?? ''}
                    />
                  </Field>
                  <Field label="City">
                    <Input name="city" defaultValue={set.city ?? ''} />
                  </Field>
                  <Field label="Address">
                    <Input name="addressLine" defaultValue={set.addressLine ?? ''} />
                  </Field>
                  <Field label="Phone">
                    <Input name="phone" defaultValue={set.phone ?? ''} />
                  </Field>
                  <Field label="Email">
                    <Input name="email" type="email" defaultValue={set.email ?? ''} />
                  </Field>
                </div>
                <Button type="submit" disabled={busy}>
                  Save & continue
                </Button>
              </form>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                {set.credential ? (
                  <p className="text-sm text-muted-foreground">
                    Active device: <span className="font-mono">{set.credential.clientId}</span> ·
                    secret <span className="font-mono">{set.credential.secretHint}</span> · income
                    source <span className="font-mono">{set.credential.incomeSourceSequence}</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Register a device on the JoFotara portal (Linking Electronic Devices → Link a
                    New Device), then paste the generated credentials here. The secret is stored
                    encrypted and never shown again.
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Client ID">
                    <Input
                      value={cred.clientId}
                      onChange={(e) => setCred((c) => ({ ...c, clientId: e.target.value }))}
                    />
                  </Field>
                  <Field label="Secret key (write-only)">
                    <Input
                      type="password"
                      value={cred.secret}
                      onChange={(e) => setCred((c) => ({ ...c, secret: e.target.value }))}
                    />
                  </Field>
                  <Field label="Income source sequence">
                    <Input
                      value={cred.incomeSourceSequence}
                      onChange={(e) =>
                        setCred((c) => ({ ...c, incomeSourceSequence: e.target.value }))
                      }
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy || !cred.clientId || !cred.secret || !cred.incomeSourceSequence}
                    onClick={() => void saveCredentials()}
                  >
                    Save credentials
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => void testConnection()}>
                    Test connection
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={() => void patch({}, 3)}>
                    Continue
                  </Button>
                </div>
                {set.lastTestAt ? (
                  <p className="text-xs text-muted-foreground">
                    Last test: {new Date(set.lastTestAt).toLocaleString()} —{' '}
                    <Badge tone={set.lastTestOk ? 'success' : 'danger'}>
                      {set.lastTestOk ? 'OK' : 'Failed'}
                    </Badge>
                  </p>
                ) : null}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Taxpayer type">
                    <Select
                      value={set.taxpayerType}
                      onChange={(e) =>
                        void patch({
                          taxpayerType: e.target.value as 'INCOME' | 'SALES' | 'SPECIAL',
                        })
                      }
                    >
                      <option value="INCOME">Income (no VAT — most schools)</option>
                      <option value="SALES">General sales tax</option>
                      <option value="SPECIAL">Special sales tax</option>
                    </Select>
                  </Field>
                  <Field label="Default invoice kind">
                    <Select
                      value={set.defaultPaymentKind}
                      onChange={(e) =>
                        void patch({ defaultPaymentKind: e.target.value as 'CASH' | 'RECEIVABLE' })
                      }
                    >
                      <option value="RECEIVABLE">Receivable (fee invoices)</option>
                      <option value="CASH">Cash (point-of-payment receipts)</option>
                    </Select>
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">
                  Invoice lines map from your fee plans and charge descriptions (Tuition, Transport,
                  Uniform, Books, Activities…). Buyer = the fee-paying guardian (national ID),
                  frozen onto each document at issue time.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Auto-issue invoice when a charge is raised">
                    <Select
                      value={set.autoIssueOnCharge ? 'on' : 'off'}
                      onChange={(e) => void patch({ autoIssueOnCharge: e.target.value === 'on' })}
                    >
                      <option value="off">Off (issue manually)</option>
                      <option value="on">On (automatic)</option>
                    </Select>
                  </Field>
                  <Field label="Auto credit note when an invoiced charge is reduced">
                    <Select
                      value={set.autoCreditOnAdjustment ? 'on' : 'off'}
                      onChange={(e) =>
                        void patch({ autoCreditOnAdjustment: e.target.value === 'on' })
                      }
                    >
                      <option value="off">Off</option>
                      <option value="on">On (automatic)</option>
                    </Select>
                  </Field>
                </div>
                <Button disabled={busy} onClick={() => void patch({}, 4)}>
                  Continue
                </Button>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="VAT enabled">
                    <Select
                      value={set.vatEnabled ? 'on' : 'off'}
                      onChange={(e) => void patch({ vatEnabled: e.target.value === 'on' })}
                    >
                      <option value="off">No (exempt)</option>
                      <option value="on">Yes</option>
                    </Select>
                  </Field>
                  <Field label="VAT percentage">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      defaultValue={set.vatPercent != null ? Number(set.vatPercent) : 16}
                      onBlur={(e) => void patch({ vatPercent: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Default tax category">
                    <Select
                      value={set.defaultTaxCategory}
                      onChange={(e) => void patch({ defaultTaxCategory: e.target.value })}
                    >
                      <option value="Z">Z — Exempt</option>
                      <option value="O">O — Zero-rated</option>
                      <option value="S">S — Standard</option>
                    </Select>
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">
                  Note: JoFotara's category letters are Z=exempt / O=zero-rated / S=standard — the
                  reverse of some other systems. Income-type taxpayers send no tax at all.
                </p>
                <Button disabled={busy} onClick={() => void patch({}, 5)}>
                  Continue
                </Button>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  The printed invoice embeds the returned <strong>QR code</strong>, the document
                  <strong> UUID</strong> and the validation status, with your school header.
                  Bilingual (AR/EN) layout follows the app's print styles; logo/stamp options arrive
                  with the print templates module.
                </p>
                <Button disabled={busy} onClick={() => void patch({}, 6)}>
                  Continue
                </Button>
              </div>
            ) : null}

            {step === 6 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Generates a 1 JOD test invoice and runs the full pipeline: XML generation →
                  validation → submission → response processing.
                  {set.environment === 'PRODUCTION'
                    ? ' You are in PRODUCTION — this submits a real document to ISTD.'
                    : ' Simulation: processed locally, no data leaves the server.'}
                </p>
                <Button disabled={busy || !set.enabled} onClick={() => void testSubmission()}>
                  Run test submission
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Documents / error dashboard */}
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No e-invoices yet.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Number</TH>
                    <TH>Type</TH>
                    <TH>Buyer</TH>
                    <TH>Amount (JOD)</TH>
                    <TH>ICV</TH>
                    <TH>Status</TH>
                    <TH>Error</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {docs.map((d) => (
                    <TR key={d.id}>
                      <TD className="font-mono text-xs">{d.invoiceNumber}</TD>
                      <TD>{d.docType === 'CREDIT_NOTE' ? 'Credit note' : 'Invoice'}</TD>
                      <TD dir="auto">{d.buyerName ?? '—'}</TD>
                      <TD className="font-mono">{Number(d.payableAmount).toFixed(3)}</TD>
                      <TD className="font-mono">{d.icv ?? '—'}</TD>
                      <TD>
                        <Badge tone={STATUS_TONE[d.status] ?? 'default'}>{d.status}</Badge>
                      </TD>
                      <TD className="max-w-[260px] truncate text-xs text-muted-foreground">
                        {d.lastError ?? ''}
                      </TD>
                      <TD>
                        {d.status === 'REJECTED' || d.status === 'DEAD_LETTER' ? (
                          <Button size="sm" variant="outline" onClick={() => void requeue(d.id)}>
                            Resubmit
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
      </div>
    </Shell>
  );
}

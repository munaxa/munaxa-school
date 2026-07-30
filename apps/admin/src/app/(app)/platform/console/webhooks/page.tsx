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
  PageHeader,
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
  platformConsoleApi,
  type WebhookDelivery,
  type WebhookEndpoint,
} from '@/lib/platform-console';
import { PlatformNav } from '../platform-nav';

const DELIVERY_TONE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'muted'> = {
  PENDING: 'warning',
  DELIVERED: 'success',
  FAILED: 'danger',
  DISABLED: 'muted',
};

export default function WebhooksPage() {
  const toast = useToast();
  const [rows, setRows] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ url: '', eventTypes: '' });
  const [selected, setSelected] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await platformConsoleApi.webhooks());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDeliveries = useCallback(
    async (id: string) => {
      setSelected(id);
      try {
        setDeliveries(await platformConsoleApi.webhookDeliveries(id));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load deliveries');
      }
    },
    [toast],
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await platformConsoleApi.createWebhook({
        url: form.url.trim(),
        ...(form.eventTypes
          ? {
              eventTypes: form.eventTypes
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {}),
      });
      toast.success('Endpoint registered');
      setForm({ url: '', eventTypes: '' });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    }
  }

  async function toggle(ep: WebhookEndpoint) {
    try {
      await (ep.isActive
        ? platformConsoleApi.disableWebhook(ep.id)
        : platformConsoleApi.enableWebhook(ep.id));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function rotate(id: string) {
    try {
      const ep = await platformConsoleApi.rotateWebhookSecret(id);
      toast.success(`New secret: ${ep.secret ?? ''}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to rotate');
    }
  }

  async function retry(deliveryId: string) {
    try {
      await platformConsoleApi.retryDelivery(deliveryId);
      toast.success('Retried');
      if (selected) await loadDeliveries(selected);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to retry');
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Webhooks" align="center" actions={<PlatformNav active="webhooks" />} />

        <Card>
          <CardHeader>
            <CardTitle>Register endpoint</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void create(e)} className="flex flex-wrap items-end gap-2">
              <Field label="URL" className="flex-1">
                <Input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://example.com/webhook"
                  required
                />
              </Field>
              <Field label="Events (comma-separated, blank = all)" className="flex-1">
                <Input
                  value={form.eventTypes}
                  onChange={(e) => setForm({ ...form, eventTypes: e.target.value })}
                  placeholder="subscription.updated, payment.failed"
                />
              </Field>
              <Button type="submit">Register</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Spinner /> Loading…
              </div>
            ) : rows.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">No endpoints registered.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>URL</TH>
                      <TH>Events</TH>
                      <TH>Status</TH>
                      <TH></TH>
                    </TR>
                  </THead>
                  <TBody>
                    {rows.map((ep) => (
                      <TR key={ep.id}>
                        <TD className="max-w-xs truncate">{ep.url}</TD>
                        <TD className="text-xs text-muted-foreground">
                          {ep.eventTypes.length ? ep.eventTypes.join(', ') : 'all'}
                        </TD>
                        <TD>
                          <Badge tone={ep.isActive ? 'success' : 'muted'}>
                            {ep.isActive ? 'active' : 'disabled'}
                          </Badge>
                        </TD>
                        <TD>
                          <div className="flex flex-wrap gap-1">
                            <Button variant="outline" onClick={() => void loadDeliveries(ep.id)}>
                              Deliveries
                            </Button>
                            <Button variant="outline" onClick={() => void toggle(ep)}>
                              {ep.isActive ? 'Disable' : 'Enable'}
                            </Button>
                            <Button variant="outline" onClick={() => void rotate(ep.id)}>
                              Rotate secret
                            </Button>
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {selected ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              {deliveries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deliveries.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Event</TH>
                        <TH>Status</TH>
                        <TH>Attempts</TH>
                        <TH>When</TH>
                        <TH></TH>
                      </TR>
                    </THead>
                    <TBody>
                      {deliveries.map((d) => (
                        <TR key={d.id}>
                          <TD className="font-mono text-xs">{d.eventType}</TD>
                          <TD>
                            <Badge tone={DELIVERY_TONE[d.status] ?? 'muted'}>{d.status}</Badge>
                          </TD>
                          <TD>{d.attempts}</TD>
                          <TD className="text-xs text-muted-foreground">
                            {new Date(d.createdAt).toLocaleString()}
                          </TD>
                          <TD>
                            {d.status === 'FAILED' ? (
                              <Button variant="outline" onClick={() => void retry(d.id)}>
                                Retry
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
        ) : null}
      </div>
    </Shell>
  );
}

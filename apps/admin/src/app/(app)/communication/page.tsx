'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { communicationApi, type Announcement } from '@/lib/communication';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
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
  Textarea,
} from '@axa/platform';

const AUDIENCES = ['ALL', 'PARENTS', 'TEACHERS', 'STUDENTS'];

export default function CommunicationPage() {
  const { t } = useI18n();
  const [list, setList] = useState<Announcement[]>([]);
  const [form, setForm] = useState({ title: '', body: '', audience: 'ALL' });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await communicationApi.listAnnouncements());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await communicationApi.publish(form);
      setMessage(`Published to ${res.recipients} recipient(s).`);
      setForm({ title: '', body: '', audience: 'ALL' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function toggleWhatsApp(enabled: boolean) {
    try {
      await communicationApi.setFlag('whatsapp_bridge', enabled);
      setMessage(`WhatsApp bridge ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title={t('nav.communication')} />

        <Card>
          <CardHeader>
            <CardTitle>{t('communication.newAnnouncement')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void publish(e)} className="space-y-3">
              <Field label={t('communication.title')}>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </Field>
              <Field label={t('communication.body')}>
                <Textarea
                  className="h-24"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  required
                />
              </Field>
              <div className="flex items-end gap-2">
                <Field label={t('communication.audience')} className="flex-1">
                  <Select
                    value={form.audience}
                    onChange={(e) => setForm({ ...form, audience: e.target.value })}
                  >
                    {AUDIENCES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button type="submit">{t('communication.publish')}</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-6">
            <span className="font-medium">{t('communication.whatsappBridge')}</span>
            <Button size="sm" onClick={() => void toggleWhatsApp(true)}>
              {t('communication.enable')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void toggleWhatsApp(false)}>
              {t('communication.disable')}
            </Button>
          </CardContent>
        </Card>

        {message ? <p className="text-sm text-accent-cool">{message}</p> : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Table>
          <THead>
            <TR>
              <TH>{t('communication.announcement')}</TH>
              <TH className="text-end">{t('communication.audience')}</TH>
            </TR>
          </THead>
          <TBody>
            {list.map((a) => (
              <TR key={a.id}>
                <TD>{a.title}</TD>
                <TD className="text-end">
                  <Badge tone="muted">{a.audience}</Badge>
                </TD>
              </TR>
            ))}
            {list.length === 0 ? (
              <TR>
                <TD colSpan={2}>
                  <EmptyState title={t('communication.noAnnouncements')} />
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </div>
    </Shell>
  );
}

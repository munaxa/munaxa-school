'use client';

import { useState } from 'react';
import { useDemo } from '@/lib/demo-store/context';
import { useSession } from '@/lib/session-context';
import { fmtDate } from '@/lib/format';
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
import { PageHeader, Gate } from '@/components/page';

const CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH'] as const;

export default function CommunicationPage() {
  return (
    <Gate perm="announcement:read">
      <Communication />
    </Gate>
  );
}

function Communication() {
  const { data, actions } = useDemo();
  const { can, persona } = useSession();
  const toast = useToast();
  const canSend = can('announcement:manage') || can('notification:send');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('All parents');
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>('IN_APP');

  function publish(e: React.FormEvent) {
    e.preventDefault();
    actions.addAnnouncement({
      titleEn: title,
      titleAr: title,
      body,
      audience,
      authorName: persona.displayName,
      publishedAt: new Date().toISOString().slice(0, 10),
      channels: [channel],
    });
    if (channel !== 'IN_APP') {
      actions.mockSend(
        channel as 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH',
        audience,
        `Announcement: ${title}`,
      );
    }
    toast.success(`Announcement published to ${audience} via ${channel} (mocked).`);
    setTitle('');
    setBody('');
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Communication"
        subtitle="Announcements and multi-channel messaging (all sends are mocked)."
      />

      {canSend ? (
        <Card>
          <CardHeader>
            <CardTitle>New announcement</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={publish} className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" className="col-span-full">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </Field>
              <Field label="Message" className="col-span-full">
                <Input value={body} onChange={(e) => setBody(e.target.value)} required />
              </Field>
              <Field label="Audience">
                <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
                  <option>All parents</option>
                  <option>All staff</option>
                  <option>Whole school</option>
                  <option>Transport families</option>
                </Select>
              </Field>
              <Field label="Channel">
                <Select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number])}
                >
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c.replace('_', ' ')}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="col-span-full flex justify-end">
                <Button type="submit">Publish</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Published announcements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.announcements.map((a) => (
            <div key={a.id} className="border-b border-border pb-3 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display font-semibold">{a.titleEn}</span>
                <span className="flex items-center gap-2">
                  {a.channels.map((c) => (
                    <Badge key={c} tone="muted">
                      {c}
                    </Badge>
                  ))}
                  <span className="font-mono text-xs text-muted-foreground">
                    {fmtDate(a.publishedAt)}
                  </span>
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {a.audience} · {a.authorName}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {data.outbox.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Integration outbox (mocked)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Channel</TH>
                  <TH>To</TH>
                  <TH>Summary</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {data.outbox.slice(0, 12).map((m) => (
                  <TR key={m.id}>
                    <TD>
                      <Badge tone="default">{m.channel}</Badge>
                    </TD>
                    <TD>{m.to}</TD>
                    <TD className="text-muted-foreground">{m.summary}</TD>
                    <TD>
                      <Badge tone="success">{m.status}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

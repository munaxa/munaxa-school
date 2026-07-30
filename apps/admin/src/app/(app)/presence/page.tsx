'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  EntityPicker,
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
  type PickerOption,
} from '@axa/platform';
import { loadStudentOptions } from '@/lib/pickers';
import {
  PRESENCE_EVENT_TYPES,
  PRESENCE_METHODS,
  presenceApi,
  type CreatePresenceInput,
  type PresenceEvent,
  type PresenceEventType,
  type PresenceMethod,
} from '@/lib/presence';

const TYPE_TONE: Record<PresenceEventType, 'success' | 'muted'> = {
  GATE_IN: 'success',
  RECEPTION_CHECKIN: 'success',
  GATE_OUT: 'muted',
  RECEPTION_CHECKOUT: 'muted',
};

export default function PresencePage() {
  const { t } = useI18n();
  const [events, setEvents] = useState<PresenceEvent[]>([]);
  const [students, setStudents] = useState<PickerOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setEvents(await presenceApi.listEvents());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load presence events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    loadStudentOptions()
      .then(setStudents)
      .catch(() => undefined);
  }, [load]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) map.set(s.id, s.label);
    return map;
  }, [students]);

  if (loading) {
    return (
      <Shell>
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader title={t('nav.presence')} />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('presence.recordEvent')}</CardTitle>
          </CardHeader>
          <CardContent>
            <RecordEvent onDone={load} onError={setError} />
          </CardContent>
        </Card>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-medium">{t('presence.recentEvents')}</h2>
          <Table>
            <THead>
              <TR>
                <TH>{t('presence.student')}</TH>
                <TH>{t('presence.event')}</TH>
                <TH>{t('presence.method')}</TH>
                <TH>{t('presence.time')}</TH>
              </TR>
            </THead>
            <TBody>
              {events.map((ev) => (
                <TR key={ev.id}>
                  <TD>{nameById.get(ev.studentId) ?? `${ev.studentId.slice(0, 8)}…`}</TD>
                  <TD>
                    <Badge tone={TYPE_TONE[ev.eventType]}>{ev.eventType.replace(/_/g, ' ')}</Badge>
                  </TD>
                  <TD className="text-xs text-muted-foreground">{ev.method}</TD>
                  <TD className="font-mono text-xs">
                    {ev.occurredAt.slice(0, 16).replace('T', ' ')}
                  </TD>
                </TR>
              ))}
              {events.length === 0 ? (
                <TR>
                  <TD colSpan={4}>
                    <EmptyState title={t('presence.noEvents')} />
                  </TD>
                </TR>
              ) : null}
            </TBody>
          </Table>
        </section>
      </div>
    </Shell>
  );
}

function RecordEvent({
  onDone,
  onError,
}: {
  onDone: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const { t } = useI18n();
  const [studentId, setStudentId] = useState('');
  const [cardUid, setCardUid] = useState('');
  const [eventType, setEventType] = useState<PresenceEventType>('GATE_IN');
  const [method, setMethod] = useState<PresenceMethod>('MANUAL');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId && !cardUid) {
      onError('Select a student or enter a card UID');
      return;
    }
    setBusy(true);
    try {
      const payload: CreatePresenceInput = { eventType, method };
      if (studentId) payload.studentId = studentId;
      else if (cardUid) payload.cardUid = cardUid;
      await presenceApi.createEvent(payload);
      setStudentId('');
      setCardUid('');
      await onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to record event');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-2 sm:grid-cols-2">
      <Field label={t('presence.student')} className="sm:col-span-2">
        <EntityPicker value={studentId} onChange={setStudentId} load={loadStudentOptions} />
      </Field>
      <Field label={t('presence.orCardUid')} className="sm:col-span-2">
        <Input
          placeholder={t('presence.physicalCardUid')}
          value={cardUid}
          onChange={(e) => setCardUid(e.target.value)}
          dir="ltr"
        />
      </Field>
      <Field label={t('presence.event')}>
        <Select
          value={eventType}
          onChange={(e) => setEventType(e.target.value as PresenceEventType)}
        >
          {PRESENCE_EVENT_TYPES.map((tp) => (
            <option key={tp} value={tp}>
              {tp.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('presence.method')}>
        <Select value={method} onChange={(e) => setMethod(e.target.value as PresenceMethod)}>
          {PRESENCE_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" className="sm:col-span-2" disabled={busy}>
        {busy ? t('common.recording') : t('presence.recordEventBtn')}
      </Button>
    </form>
  );
}

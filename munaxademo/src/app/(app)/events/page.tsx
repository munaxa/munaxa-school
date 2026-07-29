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
  Field,
  Input,
  Select,
  useToast,
  type Tone,
} from '@axa/platform';
import { PageHeader } from '@/components/page';
import type { SchoolEvent } from '@/seed/types';

const CATEGORIES: SchoolEvent['category'][] = [
  'ACADEMIC',
  'SPORTS',
  'CULTURAL',
  'HOLIDAY',
  'MEETING',
];
const CAT_TONE: Record<SchoolEvent['category'], Tone> = {
  ACADEMIC: 'default',
  SPORTS: 'success',
  CULTURAL: 'warning',
  HOLIDAY: 'muted',
  MEETING: 'default',
};

export default function EventsPage() {
  const { data, actions } = useDemo();
  const { can } = useSession();
  const toast = useToast();
  const canManage = can('announcement:manage');

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(
    new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
  );
  const [category, setCategory] = useState<SchoolEvent['category']>('ACADEMIC');
  const [location, setLocation] = useState('Main Hall');

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = data.events.filter((e) => e.date >= today);
  const past = data.events.filter((e) => e.date < today);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="School events" subtitle={`${upcoming.length} upcoming`} />

      {canManage ? (
        <Card>
          <CardContent className="pt-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                actions.addEvent({
                  titleEn: title,
                  titleAr: title,
                  date,
                  category,
                  audience: 'Whole school',
                  location,
                });
                toast.success('Event added (demo only).');
                setTitle('');
              }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <Field label="Title" className="col-span-full">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </Field>
              <Field label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Category">
                <Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SchoolEvent['category'])}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Location">
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
              </Field>
              <div className="col-span-full flex justify-end">
                <Button type="submit">Add event</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Upcoming</p>
        {upcoming.map((e) => (
          <EventRow key={e.id} event={e} />
        ))}
        {past.length > 0 ? (
          <>
            <p className="mt-4 font-mono text-xs uppercase tracking-wide text-muted-foreground">
              Past
            </p>
            {past.map((e) => (
              <EventRow key={e.id} event={e} muted />
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}

function EventRow({ event, muted }: { event: SchoolEvent; muted?: boolean }) {
  return (
    <Card className={muted ? 'opacity-70' : ''}>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="font-display font-semibold">{event.titleEn}</p>
          <p className="text-xs text-muted-foreground">
            {event.location} · {event.audience}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={CAT_TONE[event.category]}>{event.category}</Badge>
          <span className="font-mono text-sm">{fmtDate(event.date)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

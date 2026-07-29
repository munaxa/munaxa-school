'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/i18n-provider';
import { type Student } from '@/lib/people';
import { busApi, type StudentTransport } from '@/lib/bus';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
} from '@axa/platform';

/**
 * Transport tab — read-only view of the student's route assignment (from the Fleet module).
 * Management (assigning routes/stops) stays in Fleet; this links there.
 */
export function TransportTab({ student }: { student: Student }) {
  const { t } = useI18n();
  const [transport, setTransport] = useState<StudentTransport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    busApi
      .studentTransport(student.id)
      .then((tr) => active && setTransport(tr))
      .catch(() => active && setTransport(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [student.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const tripLabel = transport?.tripRound
    ? transport.tripRound === 1
      ? t('fleet.trip1')
      : transport.tripRound === 2
        ? t('fleet.trip2')
        : t('transport.trip.both')
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{t('nav.fleet')}</CardTitle>
          <Link href="/fleet">
            <Button size="sm" variant="ghost">
              {t('studentProfile.manageInFleet')}
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {transport?.routeName ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Detail label={t('fleet.route')} value={transport.routeName} />
            <Detail label={t('fleet.trip')} value={tripLabel} />
            <Detail
              label={t('fleet.busNumber')}
              value={transport.busNumber ?? transport.busPlate ?? null}
            />
          </div>
        ) : (
          <EmptyState
            title={t('studentProfile.noTransport')}
            action={
              student.transportRequested ? (
                <Badge tone="warning">{t('transport.editStudent.transportRequested')}</Badge>
              ) : undefined
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value || '—'}</div>
    </div>
  );
}

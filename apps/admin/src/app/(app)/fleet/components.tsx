'use client';

import { useState, type ReactNode } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { Badge, Button, Dialog, Field, Select } from '@axa/platform';
import { TRIP_OPTIONS, type Capacity, type RouteVM, type TripValue } from './lib';

// ---------------------------------------------------------------------------
// Capacity / status visuals — warnings only, never blocking.
// ---------------------------------------------------------------------------
export function RouteStatusBadge({ capacity }: { capacity: Capacity }) {
  const { t } = useI18n();
  switch (capacity.state) {
    case 'exceeded':
      return (
        <Badge tone="danger" aria-label={t('transport.status.exceeded')}>
          ⚠ {t('transport.status.exceeded')} +{capacity.exceeded}
        </Badge>
      );
    case 'near':
      return <Badge tone="warning">{t('transport.status.near')}</Badge>;
    case 'unset':
      return <Badge tone="muted">{t('transport.status.noCapacity')}</Badge>;
    default:
      return <Badge tone="success">{t('transport.status.normal')}</Badge>;
  }
}

export function CapacityMeter({ capacity }: { capacity: Capacity }) {
  const { t } = useI18n();
  const barColor =
    capacity.state === 'exceeded'
      ? 'bg-destructive'
      : capacity.state === 'near'
        ? 'bg-accent-warm'
        : 'bg-accent-cool';
  const exceededBar = capacity.state === 'exceeded';
  return (
    <div className="space-y-1">
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-secondary/60"
        role="progressbar"
        aria-valuenow={capacity.assigned}
        aria-valuemin={0}
        aria-valuemax={Math.max(capacity.capacity, capacity.assigned)}
        aria-label={t('transport.capacity.label')}
      >
        <div className={`h-full ${barColor}`} style={{ width: `${capacity.percent}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {t('transport.capacity.label')}: {capacity.capacity || '—'}
        </span>
        {exceededBar ? (
          <span className="font-semibold text-destructive">
            {capacity.assigned} ({t('transport.status.exceeded')} +{capacity.exceeded})
          </span>
        ) : (
          <span className="text-muted-foreground">
            {t('transport.capacity.assigned')} {capacity.assigned} ·{' '}
            {t('transport.capacity.available')} {capacity.available}
          </span>
        )}
      </div>
    </div>
  );
}

export function TripBadge({ round }: { round: number | null | undefined }) {
  const { t } = useI18n();
  if (round == null) return <span className="text-muted-foreground">—</span>;
  const tone = round === 3 ? 'default' : 'muted';
  const key =
    round === 1
      ? 'transport.trip.first'
      : round === 2
        ? 'transport.trip.second'
        : 'transport.trip.both';
  return <Badge tone={tone}>{t(key)}</Badge>;
}

// ---------------------------------------------------------------------------
// Sticky bulk action bar
// ---------------------------------------------------------------------------
export function BulkActionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  if (count === 0) return null;
  return (
    <div className="sticky bottom-4 z-20 mt-4">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
        <span className="text-sm font-semibold">
          {count} {t('transport.bulk.selected')}
        </span>
        <span className="ms-auto flex flex-wrap gap-2">{children}</span>
        <Button size="sm" variant="ghost" onClick={onClear}>
          {t('transport.bulk.clear')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assign / Move dialog — pick a route (with live capacity hint) + a trip.
// Capacity is shown as a warning; it never disables the confirm button.
// ---------------------------------------------------------------------------
export function AssignDialog({
  open,
  onClose,
  title,
  count,
  routes,
  defaultRouteId,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  count: number;
  routes: RouteVM[];
  defaultRouteId?: string;
  onConfirm: (routeId: string, trip: TripValue) => Promise<void>;
}) {
  const { t } = useI18n();
  const [routeId, setRouteId] = useState(defaultRouteId ?? '');
  const [trip, setTrip] = useState<TripValue>('3');
  const [busy, setBusy] = useState(false);

  const target = routes.find((r) => r.route.id === routeId);
  // Project the post‑assignment load so coordinators see the consequence.
  const projected = target ? target.capacity.assigned + count : 0;
  const willExceed = target
    ? target.capacity.capacity > 0 && projected > target.capacity.capacity
    : false;

  async function confirm() {
    if (!routeId) return;
    setBusy(true);
    try {
      await onConfirm(routeId, trip);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={() => void confirm()} disabled={busy || !routeId}>
            {t('transport.bulk.assign')} · {count}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {count} {t('transport.bulk.willBeAssigned')}
        </p>
        <Field label={t('transport.assignTo')}>
          <Select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            <option value="">{t('fleet.selectRoute')}</option>
            {routes.map((r) => (
              <option key={r.route.id} value={r.route.id}>
                {r.route.name}
                {r.capacity.capacity > 0 ? ` — ${r.capacity.assigned}/${r.capacity.capacity}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('fleet.trip')}>
          <Select value={trip} onChange={(e) => setTrip(e.target.value as TripValue)}>
            {TRIP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.key)}
              </option>
            ))}
          </Select>
        </Field>
        {willExceed ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            ⚠ {t('transport.capacity.willExceed')} {projected}/{target?.capacity.capacity ?? 0}.{' '}
            {t('transport.capacity.allowedAnyway')}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Change‑trip dialog
// ---------------------------------------------------------------------------
export function ChangeTripDialog({
  open,
  onClose,
  count,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  onConfirm: (trip: TripValue) => Promise<void>;
}) {
  const { t } = useI18n();
  const [trip, setTrip] = useState<TripValue>('3');
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await onConfirm(trip);
      onClose();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('transport.bulk.changeTrip')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={() => void confirm()} disabled={busy}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('transport.bulk.changeTripIntro')} {count}.
        </p>
        <Field label={t('fleet.trip')}>
          <Select value={trip} onChange={(e) => setTrip(e.target.value as TripValue)}>
            {TRIP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.key)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Confirm dialog (destructive actions)
// ---------------------------------------------------------------------------
export function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={() => void go()} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted-foreground">{message}</p>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Suggest Assignments — UX + component contract for future automation.
// No backend intelligence yet (see brief: "Prepare UX and component architecture").
// ---------------------------------------------------------------------------
export interface Suggestion {
  studentId: string;
  studentName: string;
  routeId: string;
  routeName: string;
  trip: TripValue;
}

export function SuggestAssignmentsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  // Phase 1: the engine is not implemented. Render the review surface only.
  const suggestions: Suggestion[] = [];
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('transport.suggest.title')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" disabled>
            {t('transport.suggest.apply')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('transport.suggest.intro')}</p>
        {suggestions.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            {t('transport.suggest.empty')}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 w-full animate-pulse rounded-md bg-secondary/60" />
      ))}
    </div>
  );
}

export function CardSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="h-44 animate-pulse rounded-xl bg-secondary/60" />
      ))}
    </div>
  );
}

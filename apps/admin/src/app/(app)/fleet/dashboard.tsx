'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
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
  Select,
} from '@axa/platform';
import { CapacityMeter, RouteStatusBadge } from './components';
import { UNZONED, useDebouncedValue, type RouteVM, type TransportData } from './lib';

type SortKey = 'name' | 'occupancy' | 'exceeded';
type StatusFilter = 'all' | 'normal' | 'near' | 'exceeded';

export function RouteDashboard({
  data,
  onManage,
}: {
  data: TransportData;
  onManage: (vm: RouteVM) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const search = useDebouncedValue(query);

  const areaNames = useMemo(
    () => [...new Set(data.routeVMs.map((v) => v.area))].sort(),
    [data.routeVMs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = data.routeVMs.filter((v) => {
      if (area !== 'all' && v.area !== area) return false;
      if (status !== 'all' && v.capacity.state !== status) return false;
      if (
        q &&
        !v.route.name.toLowerCase().includes(q) &&
        !(v.busLabel ?? '').toLowerCase().includes(q)
      )
        return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === 'occupancy') return b.capacity.percent - a.capacity.percent;
      if (sort === 'exceeded') return b.capacity.exceeded - a.capacity.exceeded;
      return a.route.name.localeCompare(b.route.name);
    });
    return list;
  }, [data.routeVMs, area, status, search, sort]);

  const stats = useMemo(() => {
    const seats = data.routeVMs.reduce((s, v) => s + v.capacity.capacity, 0);
    const assigned = data.routeVMs.reduce((s, v) => s + v.capacity.assigned, 0);
    const over = data.routeVMs.filter((v) => v.capacity.state === 'exceeded').length;
    return { routes: data.routeVMs.length, seats, assigned, over };
  }, [data.routeVMs]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('transport.stats.routes')} value={stats.routes} />
        <Stat label={t('transport.stats.seats')} value={stats.seats} />
        <Stat label={t('transport.stats.assigned')} value={stats.assigned} />
        <Stat
          label={t('transport.stats.overCapacity')}
          value={stats.over}
          tone={stats.over > 0 ? 'danger' : 'muted'}
        />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Field label={t('common.search')} className="flex-1 min-w-48">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('transport.dashboard.searchRoutes')}
          />
        </Field>
        <Field label={t('transport.table.area')}>
          <Select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="all">{t('transport.filter.allAreas')}</option>
            {areaNames.map((a) => (
              <option key={a} value={a}>
                {a === UNZONED ? t('transport.area.unzoned') : a}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('transport.dashboard.status')}>
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="all">{t('transport.filter.allStatuses')}</option>
            <option value="normal">{t('transport.status.normal')}</option>
            <option value="near">{t('transport.status.near')}</option>
            <option value="exceeded">{t('transport.status.exceeded')}</option>
          </Select>
        </Field>
        <Field label={t('transport.dashboard.sort')}>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="name">{t('transport.sort.name')}</option>
            <option value="occupancy">{t('transport.sort.occupancy')}</option>
            <option value="exceeded">{t('transport.sort.exceeded')}</option>
          </Select>
        </Field>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t('transport.dashboard.noRoutes')}
          description={t('transport.dashboard.noRoutesDesc')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((vm) => (
            <RouteCard key={vm.route.id} vm={vm} years={data.years} onManage={onManage} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'danger' | 'muted';
}) {
  const color =
    tone === 'danger'
      ? 'text-destructive'
      : tone === 'muted'
        ? 'text-muted-foreground'
        : 'text-foreground';
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-1 font-display text-2xl font-semibold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function RouteCard({
  vm,
  years,
  onManage,
}: {
  vm: RouteVM;
  years: TransportData['years'];
  onManage: (vm: RouteVM) => void;
}) {
  const { t } = useI18n();
  const yearName = vm.route.academicYearId
    ? (years.find((y) => y.id === vm.route.academicYearId)?.name ?? null)
    : null;

  return (
    <Card className={vm.route.disabledAt ? 'opacity-60' : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{vm.route.name}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {yearName ?? t('fleet.noYear')} ·{' '}
              {vm.area === UNZONED ? t('transport.area.unzoned') : vm.area}
            </p>
          </div>
          <RouteStatusBadge capacity={vm.capacity} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            {t('fleet.busNumber')}: <span className="text-foreground">{vm.busLabel ?? '—'}</span>
          </span>
          <span>
            {t('fleet.driver')}: <span className="text-foreground">{vm.driverName ?? '—'}</span>
          </span>
        </div>
        <CapacityMeter capacity={vm.capacity} />
        <div className="flex gap-2 text-xs">
          <Badge tone="muted">
            {t('transport.trip.first')}: {vm.trip1}
          </Badge>
          <Badge tone="muted">
            {t('transport.trip.second')}: {vm.trip2}
          </Badge>
        </div>
        <Button size="sm" variant="outline" className="w-full" onClick={() => onManage(vm)}>
          {t('transport.dashboard.manageRoute')}
        </Button>
      </CardContent>
    </Card>
  );
}

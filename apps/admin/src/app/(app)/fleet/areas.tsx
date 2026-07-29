'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from '@axa/platform';
import { CapacityMeter, RouteStatusBadge, SuggestAssignmentsDialog } from './components';
import { UNZONED, exportRowsCsv, type AreaVM, type RouteVM, type TransportData } from './lib';

/**
 * Area Planning — the primary, geographic workflow. Coordinators pick an area, see the
 * routes serving it and their occupancy, then manage riders route‑by‑route.
 */
export function AreaPlanning({
  data,
  onManage,
}: {
  data: TransportData;
  onManage: (vm: RouteVM) => void;
}) {
  const { t } = useI18n();
  const [activeArea, setActiveArea] = useState<string | null>(null);

  const area = useMemo(
    () => data.areas.find((a) => a.name === activeArea) ?? null,
    [data.areas, activeArea],
  );

  if (data.areas.length === 0) {
    return (
      <EmptyState title={t('transport.area.empty')} description={t('transport.area.emptyDesc')} />
    );
  }

  if (area) {
    return (
      <AreaDetail data={data} area={area} onBack={() => setActiveArea(null)} onManage={onManage} />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('transport.area.intro')}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.areas.map((a) => (
          <button
            key={a.name}
            type="button"
            onClick={() => setActiveArea(a.name)}
            className="rounded-xl border border-border bg-card p-5 text-start transition-colors hover:border-primary/50 hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <p className="font-display text-lg font-semibold">
              {a.name === UNZONED ? t('transport.area.unzoned') : a.name}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {a.needCount} {t('transport.area.needTransport')} · {a.routes.length}{' '}
              {t('fleet.routesSuffix')}
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {a.routes.some((r) => r.capacity.state === 'exceeded') ? (
                <Badge tone="danger">{t('transport.status.exceeded')}</Badge>
              ) : null}
              <Badge tone="muted">
                {t('transport.area.assignedWord')} {a.assignedCount}
              </Badge>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AreaDetail({
  data,
  area,
  onBack,
  onManage,
}: {
  data: TransportData;
  area: AreaVM;
  onBack: () => void;
  onManage: (vm: RouteVM) => void;
}) {
  const { t } = useI18n();
  const [suggestOpen, setSuggestOpen] = useState(false);

  const areaRows = useMemo(
    () => data.rows.filter((r) => r.assignment && r.area === area.name),
    [data.rows, area.name],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}>
          ‹ {t('transport.area.backToAreas')}
        </Button>
        <h2 className="font-display text-xl font-semibold">
          {area.name === UNZONED ? t('transport.area.unzoned') : area.name}
        </h2>
        <Badge tone="muted">
          {area.needCount} {t('transport.area.needTransport')}
        </Badge>
        <Badge tone="muted">
          {t('transport.area.assignedWord')} {area.assignedCount}
        </Badge>
        <span className="ms-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setSuggestOpen(true)}>
            {t('transport.suggest.cta')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => exportRowsCsv(areaRows, `${area.name}-students.csv`)}
          >
            {t('common.export')}
          </Button>
        </span>
      </div>

      {area.routes.length === 0 ? (
        <EmptyState title={t('transport.area.noRoutes')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {area.routes.map((vm) => (
            <Card key={vm.route.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{vm.route.name}</CardTitle>
                  <RouteStatusBadge capacity={vm.capacity} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
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
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t('transport.area.assignNote')}</p>

      <SuggestAssignmentsDialog open={suggestOpen} onClose={() => setSuggestOpen(false)} />
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Shell, usePrincipal } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import {
  Badge,
  Button,
  Card,
  CardContent,
  ErrorState,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@axa/platform';
import { CardSkeleton } from './components';
import { RouteDashboard } from './dashboard';
import { AreaPlanning } from './areas';
import { UnassignedStudents } from './unassigned';
import { RouteStudentsDrawer } from './route-students';
import { BulkImport } from './bulk-import';
import { Setup } from './setup';
import { useTransport, type RouteVM } from './lib';

export default function FleetPage() {
  return (
    <Shell>
      <Transport />
    </Shell>
  );
}

function Transport() {
  const { t } = useI18n();
  const principal = usePrincipal();
  const held = new Set(principal.permissions);
  const canManage = held.has('bus:manage') || held.has('*');
  const canAssign = canManage || held.has('bus:assign');

  const data = useTransport();
  const [tab, setTab] = useState('dashboard');
  const [activeRoute, setActiveRoute] = useState<RouteVM | null>(null);

  // Keep the open drawer's view model in sync with optimistic data changes.
  const liveActive = activeRoute
    ? (data.routeVMs.find((v) => v.route.id === activeRoute.route.id) ?? activeRoute)
    : null;

  if (data.unavailable) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader title={t('nav.fleet')} />
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {t('fleet.unavailable')}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t('nav.fleet')}</h1>
          <p className="text-sm text-muted-foreground">{t('transport.subtitle')}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge tone="muted">
            {data.routes.length} {t('fleet.routesSuffix')}
          </Badge>
          <Badge tone="muted">
            {data.buses.length} {t('fleet.busesSuffix')}
          </Badge>
        </div>
      </header>

      {data.error && data.routes.length === 0 ? (
        <ErrorState
          title={t('transport.loadError')}
          description={data.error}
          action={
            <Button size="sm" variant="outline" onClick={() => void data.reload()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard">{t('transport.tabs.dashboard')}</TabsTrigger>
          <TabsTrigger value="areas">{t('transport.tabs.areas')}</TabsTrigger>
          <TabsTrigger value="unassigned">{t('transport.tabs.unassigned')}</TabsTrigger>
          <TabsTrigger value="import">{t('transport.tabs.import')}</TabsTrigger>
          <TabsTrigger value="setup">{t('transport.tabs.setup')}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="pt-4">
          {data.loading ? (
            <CardSkeleton />
          ) : (
            <RouteDashboard data={data} onManage={setActiveRoute} />
          )}
        </TabsContent>
        <TabsContent value="areas" className="pt-4">
          {data.loading ? <CardSkeleton /> : <AreaPlanning data={data} onManage={setActiveRoute} />}
        </TabsContent>
        <TabsContent value="unassigned" className="pt-4">
          {data.loading ? (
            <CardSkeleton cards={1} />
          ) : (
            <UnassignedStudents data={data} canAssign={canAssign} />
          )}
        </TabsContent>
        <TabsContent value="import" className="pt-4">
          <BulkImport data={data} canAssign={canAssign} />
        </TabsContent>
        <TabsContent value="setup" className="pt-4">
          <Setup data={data} canManage={canManage} />
        </TabsContent>
      </Tabs>

      <RouteStudentsDrawer
        data={data}
        vm={liveActive}
        canManage={canAssign}
        onClose={() => setActiveRoute(null)}
      />
    </div>
  );
}

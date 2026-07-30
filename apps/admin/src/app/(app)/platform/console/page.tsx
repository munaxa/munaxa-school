'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Shell } from '@/components/shell';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Spinner,
  StatCard,
  useToast,
} from '@axa/platform';
import { platformConsoleApi, type DashboardMetrics } from '@/lib/platform-console';
import { formatPrice } from '@/lib/subscription';
import { PlatformNav } from './platform-nav';

/** Platform Console — operational dashboard (Munaxa employees only). */
export default function PlatformConsoleDashboard() {
  const toast = useToast();
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setData(await platformConsoleApi.dashboard());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Platform Console"
          description="Munaxa operations — subscriptions, billing and platform health across all schools."
          align="center"
          actions={<PlatformNav active="dashboard" />}
        />

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Spinner /> Loading…
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Schools" value={data.schools} />
              <StatCard label="Active subscriptions" value={data.subscriptions} />
              <StatCard label="Pending upgrades" value={data.pendingUpgradeRequests} />
              <StatCard label="Active trials" value={data.trialSchools} />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                label="Trial conversion"
                value={
                  data.trialConversionRate === null
                    ? '—'
                    : `${Math.round(data.trialConversionRate * 100)}%`
                }
              />
              <StatCard label="Renewals this month" value={data.renewalsThisMonth} />
              <StatCard label="Churned this month" value={data.churnedThisMonth} />
              <StatCard label="Failed payments" value={data.failedPayments} />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Schools near limits" value={data.schoolsApproachingLimits} />
              <StatCard
                label="JoFotara / AI adoption"
                value={`${data.featureAdoption.jofotara} / ${data.featureAdoption.ai}`}
              />
              <StatCard label="Storage used (GB)" value={data.storageUsageGb.toLocaleString()} />
              <StatCard label="API traffic" value={data.apiTraffic.toLocaleString()} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Monthly recurring (MRR)</span>
                    <span className="font-display text-2xl font-semibold">
                      {formatPrice(data.revenue.mrr, data.revenue.currency)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Annual run-rate (ARR)</span>
                    <span className="font-medium">
                      {formatPrice(data.revenue.arr, data.revenue.currency)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-2">
                    {Object.entries(data.revenue.perTier).map(([tier, v]) => (
                      <div key={tier} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{tier}</span>
                        <span>{formatPrice(v, data.revenue.currency)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Subscriptions by plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(data.subscriptionsByTier).map(([tier, count]) => (
                    <div key={tier} className="flex items-center justify-between">
                      <span className="text-sm">{tier}</span>
                      <Badge tone="default">{count}</Badge>
                    </div>
                  ))}
                  <div className="mt-3 border-t border-border pt-2">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">By status</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(data.subscriptionsByStatus).map(([status, count]) => (
                        <Badge key={status} tone="muted">
                          {status}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-wrap gap-3">
              <QuickLink href="/platform/console/schools" label="Schools" />
              <QuickLink href="/platform/console/organizations" label="Organizations" />
              <QuickLink href="/platform/console/subscriptions" label="Subscriptions" />
              <QuickLink href="/platform/console/upgrade-requests" label="Upgrade Requests" />
              <QuickLink href="/platform/console/plans" label="Plan Versions" />
              <QuickLink href="/platform/console/webhooks" label="Webhooks" />
              <QuickLink href="/platform/console/audit" label="Audit Log" />
            </div>
          </>
        ) : null}
      </div>
    </Shell>
  );
}

function QuickLink({ href, label }: { href: Route; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-secondary/60"
    >
      {label} →
    </Link>
  );
}

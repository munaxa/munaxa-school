'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/shell';
import { Badge, DataGrid, EmptyState, PageHeader, useToast, type ColumnDef } from '@axa/platform';
import { platformConsoleApi, type SubscriptionRow } from '@/lib/platform-console';
import { useGridLabels } from '@/components/grid-labels';
import { PlatformNav } from '../platform-nav';

const TONE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'muted'> = {
  ACTIVE: 'success',
  TRIALING: 'default',
  GRACE_PERIOD: 'warning',
  PAST_DUE: 'warning',
  SUSPENDED: 'danger',
  CANCELLED: 'muted',
  EXPIRED: 'danger',
};

export default function PlatformSubscriptionsPage() {
  const toast = useToast();
  const router = useRouter();
  const labels = useGridLabels();
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setRows(await platformConsoleApi.subscriptions());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<ColumnDef<(typeof rows)[number]>[]>(
    () => [
      {
        id: 'school',
        header: 'School',
        value: (r) => r.tenant.name,
        sortable: true,
        rowHeader: true,
        multiline: true,
        cell: (r) => (
          <div>
            <div className="font-medium">{r.tenant.name}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{r.tenant.slug}</div>
          </div>
        ),
      },
      { id: 'plan', header: 'Plan', value: (r) => r.plan.name, sortable: true },
      {
        id: 'status',
        header: 'Status',
        value: (r) => r.status,
        sortable: true,
        cell: (r) => <Badge tone={TONE[r.status] ?? 'muted'}>{r.status}</Badge>,
      },
      { id: 'cycle', header: 'Cycle', value: (r) => r.billingCycle, sortable: true },
      {
        id: 'renewal',
        header: 'Renewal',
        value: (r) => r.currentPeriodEnd ?? '',
        sortable: true,
        cell: (r) => (r.currentPeriodEnd ? new Date(r.currentPeriodEnd).toLocaleDateString() : '—'),
      },
    ],
    [],
  );

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Subscriptions"
          align="center"
          actions={<PlatformNav active="subscriptions" />}
        />

        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          getRowLabel={(r) => r.tenant.name}
          labels={labels}
          searchable={false}
          loading={loading}
          onRowActivate={(r) => router.push(`/platform/console/schools/${r.tenantId}`)}
          aria-label="Subscriptions"
          emptyState={<EmptyState title="No subscriptions yet." />}
        />
      </div>
    </Shell>
  );
}

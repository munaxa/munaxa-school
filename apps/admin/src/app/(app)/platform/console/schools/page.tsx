'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/shell';
import {
  Badge,
  DataGrid,
  EmptyState,
  Input,
  PageHeader,
  useToast,
  type ColumnDef,
} from '@axa/platform';
import { platformConsoleApi, type SchoolRow } from '@/lib/platform-console';
import { useGridLabels } from '@/components/grid-labels';
import { PlatformNav } from '../platform-nav';

const SUB_TONE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'muted'> = {
  ACTIVE: 'success',
  TRIALING: 'default',
  GRACE_PERIOD: 'warning',
  PAST_DUE: 'warning',
  SUSPENDED: 'danger',
  CANCELLED: 'muted',
  EXPIRED: 'danger',
  NONE: 'muted',
};

export default function PlatformSchoolsPage() {
  const toast = useToast();
  const router = useRouter();
  const labels = useGridLabels();
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setRows(await platformConsoleApi.schools());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load schools');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter(
    (r) =>
      !q ||
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      r.slug.toLowerCase().includes(q.toLowerCase()),
  );

  const columns = useMemo<ColumnDef<SchoolRow>[]>(
    () => [
      {
        id: 'school',
        header: 'School',
        value: (r) => r.name,
        sortable: true,
        rowHeader: true,
        multiline: true,
        cell: (r) => (
          <div>
            <div className="font-medium">{r.name}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{r.slug}</div>
          </div>
        ),
      },
      {
        id: 'plan',
        header: 'Plan',
        value: (r) => r.plan?.name ?? '',
        sortable: true,
        cell: (r) => r.plan?.name ?? <span className="text-muted-foreground">—</span>,
      },
      {
        id: 'subscription',
        header: 'Subscription',
        value: (r) => r.subscriptionStatus,
        sortable: true,
        cell: (r) => (
          <Badge tone={SUB_TONE[r.subscriptionStatus] ?? 'muted'}>{r.subscriptionStatus}</Badge>
        ),
      },
      {
        id: 'students',
        header: 'Students',
        value: (r) => r.students,
        sortable: true,
        align: 'end',
        cell: (r) => r.students.toLocaleString(),
      },
      {
        id: 'campuses',
        header: 'Campuses',
        value: (r) => r.campuses,
        sortable: true,
        align: 'end',
      },
      {
        id: 'renewal',
        header: 'Renewal',
        value: (r) => r.renewal ?? '',
        sortable: true,
        cell: (r) => (
          <>
            {r.renewal ? new Date(r.renewal).toLocaleDateString() : '—'}
            {r.trialEndsAt ? (
              <Badge tone="default" className="ml-1">
                trial
              </Badge>
            ) : null}
          </>
        ),
      },
    ],
    [],
  );

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Schools" align="center" actions={<PlatformNav active="schools" />} />

        <div className="max-w-sm">
          <Input placeholder="Search schools…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <DataGrid
          rows={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          getRowLabel={(r) => r.name}
          labels={labels}
          searchable={false}
          loading={loading}
          onRowActivate={(r) => router.push(`/platform/console/schools/${r.id}`)}
          aria-label="Schools"
          emptyState={<EmptyState title="No schools found." />}
        />
      </div>
    </Shell>
  );
}

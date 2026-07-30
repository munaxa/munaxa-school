'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shell } from '@/components/shell';
import { DataGrid, Input, PageHeader, useToast, type ColumnDef } from '@axa/platform';
import { platformConsoleApi, type AuditRow } from '@/lib/platform-console';
import { PlatformNav } from '../platform-nav';

export default function PlatformAuditPage() {
  const toast = useToast();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await platformConsoleApi.audit({ ...(action ? { action } : {}), take: 200 }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load audit');
    } finally {
      setLoading(false);
    }
  }, [action, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<ColumnDef<AuditRow>[]>(
    () => [
      {
        id: 'when',
        header: 'When',
        value: (r) => r.createdAt,
        sortable: true,
        width: 180,
        cell: (r) => (
          <span className="text-xs text-muted-foreground">
            {new Date(r.createdAt).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'action',
        header: 'Action',
        value: (r) => r.action,
        sortable: true,
        rowHeader: true,
        cell: (r) => <span className="font-mono text-xs">{r.action}</span>,
      },
      {
        id: 'entity',
        header: 'Entity',
        value: (r) => r.entityType,
        sortable: true,
        cell: (r) => (
          <span className="text-xs">
            {r.entityType}
            {r.entityId ? (
              <span className="text-muted-foreground"> · {r.entityId.slice(0, 8)}</span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'tenant',
        header: 'Tenant',
        value: (r) => r.tenantId ?? '',
        sortable: true,
        width: 120,
        cell: (r) => (
          <span className="font-mono text-[10px] text-muted-foreground">
            {r.tenantId ? r.tenantId.slice(0, 8) : '—'}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Audit Log" align="center" actions={<PlatformNav active="audit" />} />

        <div className="max-w-sm">
          <Input
            placeholder="Filter by action (e.g. platform.subscription)"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
        </div>

        {/*
          The action filter above stays School's — it is a server query parameter, not a client
          text match — so the grid's own search is off and it renders the rows the query returned.
          `loading` is handed over too: the grid draws skeleton rows in place of the spinner.
        */}
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          getRowLabel={(r) => r.action}
          searchable={false}
          loading={loading}
          aria-label="Audit log"
        />
      </div>
    </Shell>
  );
}

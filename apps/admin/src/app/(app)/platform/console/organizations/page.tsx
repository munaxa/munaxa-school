'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/shell';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataGrid,
  EmptyState,
  Field,
  Input,
  PageHeader,
  useToast,
  type ColumnDef,
} from '@axa/platform';
import { platformConsoleApi, type OrganizationRow } from '@/lib/platform-console';
import { useGridLabels } from '@/components/grid-labels';
import { PlatformNav } from '../platform-nav';

export default function OrganizationsPage() {
  const toast = useToast();
  const router = useRouter();
  const labels = useGridLabels();
  const [rows, setRows] = useState<OrganizationRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', billingEmail: '' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await platformConsoleApi.organizations(showArchived));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }, [showArchived, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await platformConsoleApi.createOrganization({
        name: form.name.trim(),
        slug: form.slug.trim(),
        ...(form.billingEmail ? { billingEmail: form.billingEmail } : {}),
      });
      toast.success('Organization created');
      setForm({ name: '', slug: '', billingEmail: '' });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  }

  const filtered = rows.filter(
    (r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.slug.includes(q.toLowerCase()),
  );

  const columns = useMemo<ColumnDef<OrganizationRow>[]>(
    () => [
      {
        id: 'organization',
        header: 'Organization',
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
      { id: 'schools', header: 'Schools', value: (r) => r.schools, sortable: true, align: 'end' },
      {
        id: 'billingEmail',
        header: 'Billing email',
        value: (r) => r.billingEmail ?? '',
        sortable: true,
        cell: (r) => r.billingEmail ?? '—',
      },
      {
        id: 'status',
        header: 'Status',
        value: (r) => (r.isArchived ? 'Archived' : 'Active'),
        sortable: true,
        cell: (r) =>
          r.isArchived ? (
            <Badge tone="muted">Archived</Badge>
          ) : (
            <Badge tone="success">Active</Badge>
          ),
      },
    ],
    [],
  );

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Organizations"
          align="center"
          actions={<PlatformNav active="organizations" />}
        />

        <Card>
          <CardHeader>
            <CardTitle>New organization</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void create(e)} className="flex flex-wrap items-end gap-2">
              <Field label="Name" className="flex-1">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </Field>
              <Field label="Slug" className="flex-1">
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="acme-group"
                  required
                />
              </Field>
              <Field label="Billing email">
                <Input
                  value={form.billingEmail}
                  onChange={(e) => setForm({ ...form, billingEmail: e.target.value })}
                />
              </Field>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Input
            className="max-w-sm"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>

        <DataGrid
          rows={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          getRowLabel={(r) => r.name}
          labels={labels}
          searchable={false}
          loading={loading}
          onRowActivate={(r) => router.push(`/platform/console/organizations/${r.id}`)}
          aria-label="Organizations"
          emptyState={<EmptyState title="No organizations." />}
        />
      </div>
    </Shell>
  );
}

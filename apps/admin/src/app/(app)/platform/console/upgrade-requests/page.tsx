'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { Badge, Button, Card, CardContent, Input, Select, Spinner, useToast } from '@axa/platform';
import { platformConsoleApi, type PlatformUpgradeRequest } from '@/lib/platform-console';
import { PlatformNav } from '../platform-nav';

const TONE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'muted'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'muted',
};

export default function UpgradeRequestsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<PlatformUpgradeRequest[]>([]);
  const [filter, setFilter] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await platformConsoleApi.upgradeRequests(filter || undefined));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, decision: 'APPROVE' | 'REJECT') {
    try {
      await platformConsoleApi.decideUpgradeRequest(id, decision, notes[id]);
      toast.success(
        decision === 'APPROVE' ? 'Approved — new plan active immediately' : 'Request rejected',
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to decide');
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold">Upgrade Requests</h1>
          <PlatformNav active="upgrades" />
        </header>

        <div className="max-w-xs">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Spinner /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No requests.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <Card key={r.id}>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/platform/console/schools/${r.tenantId}`}
                        className="font-medium hover:underline"
                      >
                        {r.tenant.name}
                      </Link>
                      <div className="text-sm text-muted-foreground">
                        {r.fromPlan?.name ?? '—'} → <strong>{r.requestedPlan.name}</strong>
                      </div>
                      {r.note ? <p className="mt-1 text-sm">“{r.note}”</p> : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge tone={TONE[r.status] ?? 'muted'}>{r.status}</Badge>
                  </div>

                  {r.status === 'PENDING' ? (
                    <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                      <Input
                        className="flex-1"
                        placeholder="Decision note (optional)"
                        value={notes[r.id] ?? ''}
                        onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                      />
                      <Button onClick={() => void decide(r.id, 'APPROVE')}>Approve</Button>
                      <Button variant="outline" onClick={() => void decide(r.id, 'REJECT')}>
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

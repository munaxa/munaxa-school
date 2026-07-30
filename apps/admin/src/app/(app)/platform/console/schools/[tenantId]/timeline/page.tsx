'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { Badge, Card, CardContent, Input, PageHeader, Spinner, useToast } from '@axa/platform';
import { platformConsoleApi, type TimelineItem } from '@/lib/platform-console';

/** Per-school chronological activity feed, derived from the Audit Log. */
export default function SchoolTimelinePage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const toast = useToast();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setItems(await platformConsoleApi.timeline(tenantId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [tenantId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = items.filter(
    (i) => !q || i.title.toLowerCase().includes(q.toLowerCase()) || i.action.includes(q),
  );

  return (
    <Shell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link
            href={`/platform/console/schools/${tenantId}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← School detail
          </Link>
          <PageHeader title="Activity timeline" className="mt-1" />
        </div>

        <div className="max-w-sm">
          <Input placeholder="Filter activity…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Spinner /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No activity yet.
            </CardContent>
          </Card>
        ) : (
          <ol className="relative space-y-4 border-s border-border ps-6">
            {filtered.map((i) => (
              <li key={i.auditId} className="relative">
                <span className="absolute -start-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{i.title}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{i.action}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(i.at).toLocaleString()}
                  </span>
                </div>
                <Badge tone="muted" className="mt-1">
                  {i.entityType}
                </Badge>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Shell>
  );
}

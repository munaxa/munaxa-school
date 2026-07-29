'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/shell';
import {
  Badge,
  Card,
  CardContent,
  Input,
  Spinner,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@axa/platform';
import { platformConsoleApi, type SchoolRow } from '@/lib/platform-console';
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

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold">Schools</h1>
          <PlatformNav active="schools" />
        </header>

        <div className="max-w-sm">
          <Input placeholder="Search schools…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Spinner /> Loading…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>School</TH>
                      <TH>Plan</TH>
                      <TH>Subscription</TH>
                      <TH>Students</TH>
                      <TH>Campuses</TH>
                      <TH>Renewal</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {filtered.map((r) => (
                      <TR
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/platform/console/schools/${r.id}`)}
                      >
                        <TD>
                          <div className="font-medium">{r.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {r.slug}
                          </div>
                        </TD>
                        <TD>{r.plan?.name ?? <span className="text-muted-foreground">—</span>}</TD>
                        <TD>
                          <Badge tone={SUB_TONE[r.subscriptionStatus] ?? 'muted'}>
                            {r.subscriptionStatus}
                          </Badge>
                        </TD>
                        <TD>{r.students.toLocaleString()}</TD>
                        <TD>{r.campuses}</TD>
                        <TD>
                          {r.renewal ? new Date(r.renewal).toLocaleDateString() : '—'}
                          {r.trialEndsAt ? (
                            <Badge tone="default" className="ml-1">
                              trial
                            </Badge>
                          ) : null}
                        </TD>
                      </TR>
                    ))}
                    {filtered.length === 0 ? (
                      <TR>
                        <TD colSpan={6} className="text-center text-muted-foreground">
                          No schools found.
                        </TD>
                      </TR>
                    ) : null}
                  </TBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

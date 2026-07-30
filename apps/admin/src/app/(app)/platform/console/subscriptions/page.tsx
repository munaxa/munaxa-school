'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/shell';
import {
  Badge,
  Card,
  CardContent,
  PageHeader,
  Spinner,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@axa/platform';
import { platformConsoleApi, type SubscriptionRow } from '@/lib/platform-console';
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

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Subscriptions"
          align="center"
          actions={<PlatformNav active="subscriptions" />}
        />

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
                      <TH>Status</TH>
                      <TH>Cycle</TH>
                      <TH>Renewal</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {rows.map((r) => (
                      <TR
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/platform/console/schools/${r.tenantId}`)}
                      >
                        <TD>
                          <div className="font-medium">{r.tenant.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {r.tenant.slug}
                          </div>
                        </TD>
                        <TD>{r.plan.name}</TD>
                        <TD>
                          <Badge tone={TONE[r.status] ?? 'muted'}>{r.status}</Badge>
                        </TD>
                        <TD>{r.billingCycle}</TD>
                        <TD>
                          {r.currentPeriodEnd
                            ? new Date(r.currentPeriodEnd).toLocaleDateString()
                            : '—'}
                        </TD>
                      </TR>
                    ))}
                    {rows.length === 0 ? (
                      <TR>
                        <TD colSpan={5} className="text-center text-muted-foreground">
                          No subscriptions yet.
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

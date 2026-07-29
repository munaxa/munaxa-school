'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import {
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

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold">Audit Log</h1>
          <PlatformNav active="audit" />
        </header>

        <div className="max-w-sm">
          <Input
            placeholder="Filter by action (e.g. platform.subscription)"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
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
                      <TH>When</TH>
                      <TH>Action</TH>
                      <TH>Entity</TH>
                      <TH>Tenant</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {rows.map((r) => (
                      <TR key={r.id}>
                        <TD className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(r.createdAt).toLocaleString()}
                        </TD>
                        <TD className="font-mono text-xs">{r.action}</TD>
                        <TD className="text-xs">
                          {r.entityType}
                          {r.entityId ? (
                            <span className="text-muted-foreground">
                              {' '}
                              · {r.entityId.slice(0, 8)}
                            </span>
                          ) : null}
                        </TD>
                        <TD className="font-mono text-[10px] text-muted-foreground">
                          {r.tenantId ? r.tenantId.slice(0, 8) : '—'}
                        </TD>
                      </TR>
                    ))}
                    {rows.length === 0 ? (
                      <TR>
                        <TD colSpan={4} className="text-center text-muted-foreground">
                          No audit entries.
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

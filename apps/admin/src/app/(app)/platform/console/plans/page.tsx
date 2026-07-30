'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Select,
  Spinner,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@axa/platform';
import { platformConsoleApi, type PlanVersion } from '@/lib/platform-console';
import { type PlanView } from '@/lib/subscription';
import { PlatformNav } from '../platform-nav';

export default function PlanVersionsPage() {
  const toast = useToast();
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [planId, setPlanId] = useState('');
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    platformConsoleApi
      .plans()
      .then((p) => {
        setPlans(p);
        setPlanId(p[0]?.id ?? '');
      })
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  const loadVersions = useCallback(async () => {
    if (!planId) return;
    try {
      setVersions(await platformConsoleApi.planVersions(planId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load versions');
    }
  }, [planId, toast]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  async function act(label: string, fn: () => Promise<unknown>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      await loadVersions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function migrate(versionId: string) {
    try {
      const preview = await platformConsoleApi.migrationPreview(planId, versionId);
      if (!confirm(`Migrate ${preview.count} school(s) to this version?`)) return;
      const res = await platformConsoleApi.migratePlanVersion(planId, versionId);
      toast.success(`Migrated ${res.migrated} school(s)`);
      await loadVersions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Migration failed');
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Plan Versions" align="center" actions={<PlatformNav active="" />} />

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Spinner /> Loading…
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-64">
                <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                disabled={busy || !planId}
                onClick={() =>
                  void act('Version created', () => platformConsoleApi.createPlanVersion(planId))
                }
              >
                Create version (snapshot)
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Versions</CardTitle>
              </CardHeader>
              <CardContent>
                {versions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No versions yet. Create one to snapshot the current plan.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <THead>
                        <TR>
                          <TH>Version</TH>
                          <TH>Students limit</TH>
                          <TH>Features</TH>
                          <TH>Status</TH>
                          <TH></TH>
                        </TR>
                      </THead>
                      <TBody>
                        {versions.map((v) => (
                          <TR key={v.id}>
                            <TD>v{v.version}</TD>
                            <TD>{v.limits.maxStudents ?? 'Unlimited'}</TD>
                            <TD className="text-xs text-muted-foreground">
                              {v.featureCodes.length}
                            </TD>
                            <TD>
                              {v.isCurrent ? (
                                <Badge tone="success">Current</Badge>
                              ) : (
                                <Badge tone="muted">Draft/retired</Badge>
                              )}
                            </TD>
                            <TD>
                              <div className="flex flex-wrap gap-1">
                                {!v.isCurrent ? (
                                  <Button
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() =>
                                      void act('Published', () =>
                                        platformConsoleApi.publishPlanVersion(planId, v.id),
                                      )
                                    }
                                  >
                                    Publish
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() =>
                                      void act('Retired', () =>
                                        platformConsoleApi.retirePlanVersion(planId, v.id),
                                      )
                                    }
                                  >
                                    Retire
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => void migrate(v.id)}
                                >
                                  Migrate customers
                                </Button>
                              </div>
                            </TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Shell>
  );
}

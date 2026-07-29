'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Select,
  Spinner,
  StatCard,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@axa/platform';
import { platformConsoleApi, type OrganizationDetail } from '@/lib/platform-console';
import { formatPrice } from '@/lib/subscription';

export default function OrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToast();
  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [assignable, setAssignable] = useState<Array<{ id: string; name: string; slug: string }>>(
    [],
  );
  const [assignId, setAssignId] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([
        platformConsoleApi.organization(id),
        platformConsoleApi.assignableSchools(),
      ]);
      setOrg(d);
      setAssignable(a);
      setAssignId(a[0]?.id ?? '');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function assign() {
    if (!assignId) return;
    try {
      await platformConsoleApi.assignSchool(id, assignId);
      toast.success('School assigned');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to assign');
    }
  }

  async function remove(tenantId: string) {
    try {
      await platformConsoleApi.removeSchool(id, tenantId);
      toast.success('School removed');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove');
    }
  }

  async function archive() {
    if (!confirm('Archive this organization? Its schools will become standalone.')) return;
    try {
      await platformConsoleApi.archiveOrganization(id);
      toast.success('Organization archived');
      router.push('/platform/console/organizations');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to archive');
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center gap-2 p-6 text-muted-foreground">
          <Spinner /> Loading…
        </div>
      </Shell>
    );
  }
  if (!org) return null;

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link
            href="/platform/console/organizations"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Organizations
          </Link>
          <div className="mt-1 flex items-center justify-between">
            <h1 className="font-display text-2xl font-semibold">
              {org.name} {org.isArchived ? <Badge tone="muted">Archived</Badge> : null}
            </h1>
            {!org.isArchived ? (
              <Button variant="outline" onClick={() => void archive()}>
                Archive
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Schools" value={org.billingSummary.schoolCount} />
          <StatCard
            label="Est. MRR"
            value={formatPrice(org.billingSummary.estimatedMrr, org.billingSummary.currency)}
          />
          <StatCard label="Students" value={(org.usageSummary.students ?? 0).toLocaleString()} />
          <StatCard label="Consolidated billing" value={org.consolidatedBilling ? 'On' : 'Off'} />
        </div>

        {!org.isArchived ? (
          <Card>
            <CardHeader>
              <CardTitle>Assign a school</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="School" className="flex-1">
                  <Select value={assignId} onChange={(e) => setAssignId(e.target.value)}>
                    {assignable.length === 0 ? (
                      <option value="">No standalone schools</option>
                    ) : null}
                    {assignable.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.slug})
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button onClick={() => void assign()} disabled={!assignId}>
                  Assign
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Member schools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>School</TH>
                    <TH>Plan</TH>
                    <TH>Subscription</TH>
                    <TH>Students</TH>
                    <TH></TH>
                  </TR>
                </THead>
                <TBody>
                  {org.schools.map((s) => (
                    <TR key={s.id}>
                      <TD>
                        <Link
                          href={`/platform/console/schools/${s.id}`}
                          className="font-medium hover:underline"
                        >
                          {s.name}
                        </Link>
                        <div className="font-mono text-[10px] text-muted-foreground">{s.slug}</div>
                      </TD>
                      <TD>{s.plan ?? '—'}</TD>
                      <TD>
                        <Badge tone="muted">{s.subscriptionStatus}</Badge>
                      </TD>
                      <TD>{s.students.toLocaleString()}</TD>
                      <TD>
                        {!org.isArchived ? (
                          <Button variant="outline" onClick={() => void remove(s.id)}>
                            Remove
                          </Button>
                        ) : null}
                      </TD>
                    </TR>
                  ))}
                  {org.schools.length === 0 ? (
                    <TR>
                      <TD colSpan={5} className="text-center text-muted-foreground">
                        No schools in this organization.
                      </TD>
                    </TR>
                  ) : null}
                </TBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

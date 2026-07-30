'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
  Input,
  PageHeader,
  Select,
  Spinner,
  StatCard,
  useToast,
} from '@axa/platform';
import { platformConsoleApi, type SchoolDetail } from '@/lib/platform-console';
import { formatLimit, type PlanView } from '@/lib/subscription';
import { PLAN_FEATURE_KEYS } from '../../feature-keys';

const STATUSES = [
  'ACTIVE',
  'TRIALING',
  'PAST_DUE',
  'GRACE_PERIOD',
  'READ_ONLY',
  'SUSPENDED',
  'CANCELLED',
  'EXPIRED',
  'ARCHIVED',
] as const;

export default function PlatformSchoolDetailPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const toast = useToast();
  const [detail, setDetail] = useState<SchoolDetail | null>(null);
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([
        platformConsoleApi.school(tenantId),
        platformConsoleApi.plans(),
      ]);
      setDetail(d);
      setPlans(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load school');
    } finally {
      setLoading(false);
    }
  }, [tenantId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center gap-2 p-6 text-muted-foreground">
          <Spinner /> Loading…
        </div>
      </Shell>
    );
  }
  if (!detail) return null;

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link
            href="/platform/console/schools"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← All schools
          </Link>
          <PageHeader
            title={detail.name}
            align="center"
            actions={
              <div className="flex items-center gap-2">
                <Link
                  href={`/platform/console/schools/${tenantId}/billing`}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary/60"
                >
                  Billing →
                </Link>
                <Link
                  href={`/platform/console/schools/${tenantId}/timeline`}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary/60"
                >
                  Timeline →
                </Link>
                <Badge tone="muted">{detail.slug}</Badge>
              </div>
            }
            className="mt-1"
          />
        </div>

        <SubscriptionStateActions
          tenantId={tenantId}
          status={detail.subscription?.status ?? 'NONE'}
          onChanged={load}
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Students" value={detail.counts.students} />
          <StatCard label="Campuses" value={detail.counts.campuses} />
          <StatCard label="Users" value={detail.counts.users} />
          <StatCard label="Plan" value={detail.subscription?.plan.name ?? 'None'} />
        </div>

        <SubscriptionCard detail={detail} plans={plans} tenantId={tenantId} onChanged={load} />
        <OverridesCard detail={detail} tenantId={tenantId} onChanged={load} />
        <ActivityCard detail={detail} />
      </div>
    </Shell>
  );
}

function SubscriptionCard({
  detail,
  plans,
  tenantId,
  onChanged,
}: {
  detail: SchoolDetail;
  plans: PlanView[];
  tenantId: string;
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [planId, setPlanId] = useState(detail.subscription?.plan.id ?? '');
  const [cycle, setCycle] = useState(detail.subscription?.billingCycle ?? 'MONTHLY');
  const [status, setStatus] = useState(detail.subscription?.status ?? 'ACTIVE');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!planId) return toast.error('Select a plan');
    setSaving(true);
    try {
      await platformConsoleApi.changeSubscription(tenantId, {
        planId,
        billingCycle: cycle,
        status,
        ...(reason ? { reason } : {}),
      });
      toast.success('Subscription updated — features active immediately');
      setReason('');
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {detail.subscription ? (
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              Renewal:{' '}
              <strong>
                {detail.subscription.currentPeriodEnd
                  ? new Date(detail.subscription.currentPeriodEnd).toLocaleDateString()
                  : '—'}
              </strong>
            </span>
            {detail.subscription.trialEndsAt ? (
              <span>
                Trial ends:{' '}
                <strong>{new Date(detail.subscription.trialEndsAt).toLocaleDateString()}</strong>
              </span>
            ) : null}
            {detail.subscription.coupon ? (
              <Badge tone="success">{detail.subscription.coupon}</Badge>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No subscription yet — assign a plan to start enforcing limits.
          </p>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <Field label="Plan" className="flex-1">
            <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">Select…</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — students {formatLimit(p.limits.maxStudents)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cycle">
            <Select value={cycle} onChange={(e) => setCycle(e.target.value as never)}>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
              <option value="TRIAL">Trial</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as never)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Reason (optional, audited)">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. sales-assisted upgrade"
          />
        </Field>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Apply change'}
        </Button>
      </CardContent>
    </Card>
  );
}

function OverridesCard({
  detail,
  tenantId,
  onChanged,
}: {
  detail: SchoolDetail;
  tenantId: string;
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [key, setKey] = useState<string>(PLAN_FEATURE_KEYS[0]?.key ?? 'api');
  const [mode, setMode] = useState<'enable' | 'disable' | 'limit'>('enable');
  const [limit, setLimit] = useState('');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await platformConsoleApi.setOverride(tenantId, {
        key,
        ...(mode === 'limit' ? { limitOverride: Number(limit) } : { enabled: mode === 'enable' }),
        ...(reason ? { reason } : {}),
        ...(expiresAt ? { expiresAt } : {}),
      });
      toast.success('Override saved (audited)');
      setReason('');
      setLimit('');
      setExpiresAt('');
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save override');
    } finally {
      setSaving(false);
    }
  }

  async function remove(k: string) {
    try {
      await platformConsoleApi.deleteOverride(tenantId, k);
      toast.success('Override removed');
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature overrides</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enable a capability, or raise a limit, for this one school without changing its plan.
          Every override is audited; add an expiry for temporary beta access.
        </p>

        {detail.overrides.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {detail.overrides.map((o) => (
              <li key={o.key} className="flex items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <span className="font-mono">{o.key}</span>{' '}
                  {o.limitOverride !== null ? (
                    <Badge tone="default">limit {o.limitOverride}</Badge>
                  ) : (
                    <Badge tone={o.enabled ? 'success' : 'danger'}>
                      {o.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                  )}
                  {o.expiresAt ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      until {new Date(o.expiresAt).toLocaleDateString()}
                    </span>
                  ) : null}
                  {o.reason ? (
                    <span className="ml-2 text-xs text-muted-foreground">— {o.reason}</span>
                  ) : null}
                </div>
                <Button variant="outline" onClick={() => void remove(o.key)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No overrides.</p>
        )}

        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <Field label="Feature / limit key" className="flex-1">
            <Select value={key} onChange={(e) => setKey(e.target.value)}>
              {PLAN_FEATURE_KEYS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
              <option value="students">students (limit)</option>
              <option value="campuses">campuses (limit)</option>
              <option value="staff">staff (limit)</option>
              <option value="storage_gb">storage_gb (limit)</option>
            </Select>
          </Field>
          <Field label="Action">
            <Select value={mode} onChange={(e) => setMode(e.target.value as never)}>
              <option value="enable">Enable</option>
              <option value="disable">Disable</option>
              <option value="limit">Set limit</option>
            </Select>
          </Field>
          {mode === 'limit' ? (
            <Field label="Limit">
              <Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} />
            </Field>
          ) : null}
          <Field label="Expires (optional)">
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </Field>
        </div>
        <Field label="Reason (audited)">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="why this override?"
          />
        </Field>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save override'}
        </Button>
      </CardContent>
    </Card>
  );
}

function ActivityCard({ detail }: { detail: SchoolDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-1 text-sm font-medium">Upgrade requests</p>
          {detail.upgradeRequests.length ? (
            <ul className="space-y-1 text-sm">
              {detail.upgradeRequests.map((r) => (
                <li key={r.id} className="flex justify-between">
                  <span>
                    {r.fromPlan ?? '—'} → {r.requestedPlan}
                  </span>
                  <Badge tone={r.status === 'PENDING' ? 'warning' : 'muted'}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None.</p>
          )}
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Plan changes</p>
          {detail.planChanges.length ? (
            <ul className="space-y-1 text-sm">
              {detail.planChanges.map((c, i) => (
                <li key={i} className="flex justify-between text-muted-foreground">
                  <span>
                    {c.from ?? '—'} → {c.to} {c.toStatus ? `(${c.toStatus})` : ''}
                  </span>
                  <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SubscriptionStateActions({
  tenantId,
  status,
  onChanged,
}: {
  tenantId: string;
  status: string;
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run(label: string, fn: () => Promise<unknown>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const setStatus = (s: string) => platformConsoleApi.setStatus(tenantId, s as never);
  const suspended = status === 'SUSPENDED' || status === 'READ_ONLY';
  const terminal = status === 'CANCELLED' || status === 'EXPIRED';
  const active = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'GRACE_PERIOD'].includes(status);

  if (status === 'NONE') return null;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 py-4">
        <span className="mr-1 text-sm text-muted-foreground">
          State: <Badge tone="muted">{status}</Badge>
        </span>
        {status === 'TRIALING' ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run('Trial extended', () => platformConsoleApi.extendTrial(tenantId, 14))
            }
          >
            Extend trial 14d
          </Button>
        ) : null}
        {active ? (
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void run('Moved to read-only', () => setStatus('READ_ONLY'))}
            >
              Read-only
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run('Suspended', () => setStatus('SUSPENDED'), 'Suspend this school?')
              }
            >
              Suspend
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run('Cancelled', () => setStatus('CANCELLED'), 'Cancel this subscription?')
              }
            >
              Cancel
            </Button>
          </>
        ) : null}
        {suspended ? (
          <Button disabled={busy} onClick={() => void run('Resumed', () => setStatus('ACTIVE'))}>
            Resume
          </Button>
        ) : null}
        {terminal ? (
          <Button
            disabled={busy}
            onClick={() =>
              void run(
                'Restored',
                () => setStatus('ACTIVE'),
                'Restore this subscription to active?',
              )
            }
          >
            Restore
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

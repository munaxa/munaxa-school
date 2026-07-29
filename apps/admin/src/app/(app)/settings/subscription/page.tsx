'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell, usePrincipal } from '@/components/shell';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Progress,
  Select,
  Spinner,
  StatCard,
  Textarea,
  useToast,
} from '@axa/platform';
import {
  subscriptionApi,
  formatLimit,
  formatPrice,
  type PlanView,
  type SubscriptionSummary,
  type UpgradeRequest,
} from '@/lib/subscription';

const LIMIT_LABEL: Record<string, string> = {
  students: 'Students',
  campuses: 'Campuses',
  staff: 'Staff',
  storage_gb: 'Storage (GB)',
};

const STATUS_TONE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'muted'> = {
  ACTIVE: 'success',
  TRIALING: 'default',
  GRACE_PERIOD: 'warning',
  PAST_DUE: 'warning',
  SUSPENDED: 'danger',
  CANCELLED: 'muted',
  EXPIRED: 'danger',
  NONE: 'muted',
};

export default function SubscriptionSettingsPage() {
  const toast = useToast();
  const principal = usePrincipal();
  const canRequest = principal.permissions.includes('subscription:upgrade-request');
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [requests, setRequests] = useState<UpgradeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, p, r] = await Promise.all([
        subscriptionApi.summary(),
        subscriptionApi.plans(),
        subscriptionApi.upgradeRequests(),
      ]);
      setSummary(s);
      setPlans(p);
      setRequests(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
  if (!summary) return null;

  const currentTier = summary.plan?.tier;
  const upgradeOptions = plans.filter((p) => p.id !== summary.plan?.id);
  const pending = requests.find((r) => r.status === 'PENDING');

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-display text-2xl font-semibold">Subscription</h1>
          <p className="text-sm text-muted-foreground">
            Your current plan, usage and renewal. To change plan, request an upgrade — our team
            reviews and applies it (no downtime).
          </p>
        </header>

        {/* Current plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {summary.plan?.name ?? 'No plan assigned'}{' '}
                {summary.isTrial ? <Badge tone="default">Trial</Badge> : null}
              </CardTitle>
              <Badge tone={STATUS_TONE[summary.status] ?? 'muted'}>{summary.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Billing" value={summary.billingCycle ?? '—'} />
              <StatCard
                label={summary.isTrial ? 'Trial ends' : 'Renews'}
                value={
                  summary.trialEndsAt
                    ? new Date(summary.trialEndsAt).toLocaleDateString()
                    : summary.currentPeriodEnd
                      ? new Date(summary.currentPeriodEnd).toLocaleDateString()
                      : '—'
                }
              />
              <StatCard label="Days remaining" value={summary.daysRemaining ?? '—'} />
            </div>

            {/* Usage vs limits */}
            <div className="space-y-3">
              {summary.usage.map((u) => {
                const pct =
                  u.limit && u.limit > 0 ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
                return (
                  <div key={u.key}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{LIMIT_LABEL[u.key] ?? u.key}</span>
                      <span className={u.exceeded ? 'text-destructive' : 'text-muted-foreground'}>
                        {u.used.toLocaleString()} / {formatLimit(u.limit)}
                      </span>
                    </div>
                    {u.limit !== null ? <Progress value={pct} /> : null}
                    {u.exceeded ? (
                      <p className="mt-1 text-xs text-destructive">
                        You have reached the {summary.plan?.name} plan {LIMIT_LABEL[u.key] ?? u.key}{' '}
                        limit ({u.limit}). Upgrade to add more.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upgrade */}
        {pending ? (
          <Card>
            <CardContent className="flex items-center justify-between py-4">
              <span className="text-sm">
                Upgrade to <strong>{pending.requestedPlan?.name}</strong> is pending review.
              </span>
              <Badge tone="warning">Pending</Badge>
            </CardContent>
          </Card>
        ) : canRequest && upgradeOptions.length > 0 ? (
          <UpgradeForm options={upgradeOptions} currentTier={currentTier} onRequested={load} />
        ) : null}

        {/* Plan comparison */}
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <Card
              key={p.id}
              className={p.id === summary.plan?.id ? 'ring-2 ring-primary-strong' : ''}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {p.name}
                  {p.id === summary.plan?.id ? <Badge tone="success">Current</Badge> : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-display text-lg font-semibold">
                  {formatPrice(p.priceMonthly, p.currency)}
                  {p.priceMonthly !== null ? (
                    <span className="text-xs font-normal text-muted-foreground"> /mo</span>
                  ) : null}
                </p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Students: {formatLimit(p.limits.maxStudents)}</li>
                  <li>Campuses: {formatLimit(p.limits.maxCampuses)}</li>
                  <li>Staff: {formatLimit(p.limits.maxStaff)}</li>
                  <li>Storage: {formatLimit(p.limits.storageGb)} GB</li>
                </ul>
                {p.features.length ? (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {p.features.slice(0, 6).map((f) => (
                      <Badge key={f} tone="muted">
                        {f.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function UpgradeForm({
  options,
  currentTier,
  onRequested,
}: {
  options: PlanView[];
  currentTier: string | undefined;
  onRequested: () => Promise<void>;
}) {
  const toast = useToast();
  const [planId, setPlanId] = useState(options[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!planId) return;
    setSubmitting(true);
    try {
      await subscriptionApi.requestUpgrade({ requestedPlanId: planId, ...(note ? { note } : {}) });
      toast.success('Upgrade requested — our team will review it shortly');
      setNote('');
      await onRequested();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request an upgrade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentTier ? (
          <p className="text-sm text-muted-foreground">
            You are on <strong>{currentTier}</strong>. Choose a plan to request.
          </p>
        ) : null}
        <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Textarea
          placeholder="Anything we should know? (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button onClick={() => void submit()} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Request upgrade'}
        </Button>
      </CardContent>
    </Card>
  );
}

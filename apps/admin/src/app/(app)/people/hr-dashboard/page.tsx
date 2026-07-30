'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  useToast,
} from '@axa/platform';
import { hrDashboardApi, type HrAlert, type HrDashboard } from '@/lib/people';

export default function HrDashboardPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [data, setData] = useState<HrDashboard | null>(null);
  const [alerts, setAlerts] = useState<HrAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([
        hrDashboardApi.dashboard(),
        hrDashboardApi.alerts(60).catch(() => [] as HrAlert[]),
      ]);
      setData(d);
      setAlerts(a);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function download(format: 'csv' | 'xlsx' | 'pdf') {
    try {
      await hrDashboardApi.exportRoster(format);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  if (loading) {
    return (
      <Shell>
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell>
        <p className="text-sm text-destructive">{t('common.error')}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title={t('hr.dashboard')}
          align="center"
          actions={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void download('csv')}>
                CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => void download('xlsx')}>
                Excel
              </Button>
              <Link
                href="/people/employees"
                className="text-sm text-muted-foreground hover:text-primary-strong"
              >
                ← {t('nav.hr')}
              </Link>
            </div>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t('hr.headcount')} value={data.headcount.total} />
          <Stat label={t('hr.pendingApprovals')} value={data.leave.pendingApprovals} />
          <Stat label={t('hr.openPostings')} value={data.recruitment.openPostings} />
          <Stat label={t('hr.reviewsAwaitingAck')} value={data.performance.reviewsAwaitingAck} />
          <Stat label={t('hr.assetsAssigned')} value={data.assets.assigned} />
          <Stat label={t('hr.assetsAvailable')} value={data.assets.available} />
          <Stat label={t('hr.activeApplicants')} value={data.recruitment.activeApplicants} />
          <Stat label={t('hr.activeCycles')} value={data.performance.activeCycles} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('hr.headcountByStatus')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {data.headcount.byStatus.map((s) => (
                  <li key={s.status} className="flex justify-between">
                    <span className="text-muted-foreground">{s.status}</span>
                    <span className="font-mono">{s.count}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('hr.headcountByDepartment')}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.headcount.byDepartment.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.headcount.byDepartment.map((d) => (
                    <li key={d.departmentId ?? 'none'} className="flex justify-between">
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-mono">{d.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {t('hr.alerts')} ({data.windowDays} {t('hr.days')})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('hr.noAlerts')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {alerts.map((a) => (
                  <li
                    key={`${a.type}-${a.entityId}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <div>
                      <Badge tone={a.severity === 'overdue' ? 'danger' : 'warning'}>
                        {t(`hr.alertType.${a.type}`)}
                      </Badge>
                      <span className="ms-2 font-medium">{a.employeeName}</span>
                      <span className="text-muted-foreground"> · {a.label}</span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {a.dueDate}
                      {a.severity === 'overdue'
                        ? ` · ${t('hr.overdue')}`
                        : ` · ${a.daysRemaining} ${t('hr.daysLeft')}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-3xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

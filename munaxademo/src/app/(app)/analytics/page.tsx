'use client';

import { useDemo } from '@/lib/demo-store/context';
import {
  kpis,
  enrollmentByGrade,
  gradeDistribution,
  financeSummary,
  attendanceRate,
} from '@/lib/demo-store/selectors';
import { jod, pct, num } from '@/lib/format';
import { PageHeader, Gate, Kpi } from '@/components/page';
import { Card, CardContent, CardHeader, CardTitle, cn } from '@axa/platform';

export default function AnalyticsPage() {
  return (
    <Gate perm="report:read">
      <Analytics />
    </Gate>
  );
}

function ChartBar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: string;
}) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 truncate text-muted-foreground">{label}</span>
      <span className="h-3 flex-1 overflow-hidden rounded-full bg-secondary">
        <span className={cn('block h-full rounded-full', tone)} style={{ width: `${w}%` }} />
      </span>
      <span className="w-10 shrink-0 text-end font-mono">{value}</span>
    </div>
  );
}

function Analytics() {
  const { data } = useDemo();
  const k = kpis(data);
  const enroll = enrollmentByGrade(data);
  const maxEnroll = Math.max(...enroll.map((e) => e.count), 1);
  const dist = gradeDistribution(data);
  const distTotal = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  const fin = financeSummary(data);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Analytics" subtitle="Live dashboards across the whole school." />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Students" value={num(k.students)} />
        <Kpi label="Attendance" value={pct(attendanceRate(data))} tone="cool" />
        <Kpi label="Avg score" value={pct(k.avgScore)} tone="cool" />
        <Kpi label="Collection" value={pct(fin.collectionRate)} tone="cool" />
        <Kpi label="Outstanding" value={jod(fin.outstanding)} tone="warm" />
        <Kpi label="Admissions" value={num(k.admissionsOpen)} tone="primary" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Enrolment by grade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {enroll.map((e) => (
              <ChartBar
                key={e.grade.id}
                label={e.grade.nameEn}
                value={e.count}
                max={maxEnroll}
                tone="bg-primary"
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Grade distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {(['A', 'B', 'C', 'D', 'F'] as const).map((l) => (
              <ChartBar
                key={l}
                label={`Grade ${l}`}
                value={dist[l] ?? 0}
                max={distTotal}
                tone={
                  l === 'F' ? 'bg-destructive' : l === 'D' ? 'bg-accent-warm' : 'bg-accent-cool'
                }
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fee collection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <ChartBar
              label="Collected"
              value={Math.round(fin.collected)}
              max={Math.round(fin.billed)}
              tone="bg-accent-cool"
            />
            <ChartBar
              label="Outstanding"
              value={Math.round(fin.outstanding)}
              max={Math.round(fin.billed)}
              tone="bg-accent-warm"
            />
            <ChartBar
              label="Overdue"
              value={Math.round(fin.overdue)}
              max={Math.round(fin.billed)}
              tone="bg-destructive"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transport utilisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {data.routes.slice(0, 8).map((r) => (
              <ChartBar
                key={r.id}
                label={r.area}
                value={r.studentIds.length}
                max={30}
                tone="bg-primary"
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

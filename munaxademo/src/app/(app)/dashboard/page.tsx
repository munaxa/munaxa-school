'use client';

import { useDemo } from '@/lib/demo-store/context';
import { useSession } from '@/lib/session-context';
import { kpis, attendanceToday, topOutstanding, studentName } from '@/lib/demo-store/selectors';
import { jod, num, pct } from '@/lib/format';
import { PageHeader, Kpi, Bar } from '@/components/page';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@axa/platform';

export default function DashboardPage() {
  const { data } = useDemo();
  const { persona, can, org } = useSession();
  const k = kpis(data);
  const att = attendanceToday(data);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title={`Welcome, ${persona.displayName}`}
        subtitle={`${persona.nameEn} · ${org} · ${data.school.academicYear} · ${data.school.term}`}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label="Students"
          value={num(k.students)}
          href={can('student:manage') ? '/students' : undefined}
        />
        <Kpi label="Parents" value={num(k.parents)} />
        <Kpi label="Teachers" value={num(k.teachers)} />
        <Kpi
          label="Attendance"
          value={pct(k.attendanceToday)}
          tone="cool"
          href={can('attendance:read') ? '/attendance' : undefined}
        />
        {can('finance:read') ? (
          <Kpi label="Outstanding" value={jod(k.outstanding)} tone="warm" href="/finance" />
        ) : (
          <Kpi label="Avg score" value={pct(k.avgScore)} tone="cool" />
        )}
        {can('finance:read') ? (
          <Kpi label="Collected" value={jod(k.collected)} tone="cool" href="/finance" />
        ) : (
          <Kpi label="Books on loan" value={num(k.booksOnLoan)} />
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {can('attendance:read') ? (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Attendance today</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Bar
                label="Present"
                n={att.counts.PRESENT}
                total={att.total}
                className="bg-accent-cool"
              />
              <Bar label="Late" n={att.counts.LATE} total={att.total} className="bg-accent-warm" />
              <Bar
                label="Absent"
                n={att.counts.ABSENT}
                total={att.total}
                className="bg-destructive"
              />
              <Bar
                label="Excused"
                n={att.counts.EXCUSED}
                total={att.total}
                className="bg-primary"
              />
            </CardContent>
          </Card>
        ) : null}

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {data.notifications.slice(0, 6).map((n) => (
              <div
                key={n.id}
                className="flex items-center justify-between gap-3 border-b border-border pb-1.5 last:border-0"
              >
                <span className="min-w-0">
                  <span className="font-medium">{n.titleEn}</span>{' '}
                  <span className="text-muted-foreground">· {n.body}</span>
                </span>
                <Badge tone={n.tone}>{n.read ? 'read' : 'new'}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {can('finance:read') ? (
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Top outstanding balances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {topOutstanding(data, 6).map((row) => (
                <div
                  key={row.student!.id}
                  className="flex items-center justify-between gap-3 border-b border-border pb-1.5 last:border-0"
                >
                  <span>{studentName(row.student!)}</span>
                  <span className="font-mono text-accent-warm">{jod(row.balance)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { useDemo } from '@/lib/demo-store/context';
import { studentName } from '@/lib/demo-store/selectors';
import { jod, pct, fmtDate } from '@/lib/format';
import { Button, Card, CardContent, CardHeader, CardTitle, useToast } from '@axa/platform';
import { PageHeader } from '@/components/page';
import type { Student } from '@/seed/types';

export default function ParentPortalPage() {
  const { data, actions } = useDemo();
  const toast = useToast();

  // Representative family: a parent with two or more children for a richer view.
  const parent = useMemo(
    () =>
      data.parents.find((p) => p.studentIds.length >= 2) ??
      data.parents.find((p) => p.studentIds.length >= 1) ??
      data.parents[0]!,
    [data.parents],
  );
  const children = parent.studentIds
    .map((id) => data.students.find((s) => s.id === id))
    .filter((s): s is Student => Boolean(s));

  function childStats(child: Student) {
    const recs = data.attendance.filter((r) => r.studentId === child.id);
    const present = recs.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    const attRate = recs.length ? (present / recs.length) * 100 : 0;
    const grades = data.grades_records.filter((g) => g.studentId === child.id);
    const avg = grades.length ? grades.reduce((s, g) => s + g.totalPct, 0) / grades.length : 0;
    const invoices = data.invoices.filter((i) => i.studentId === child.id);
    const balance = invoices.reduce((s, i) => s + (i.amount - i.paid), 0);
    const grade = data.grades.find((g) => g.id === child.gradeId);
    return { attRate, avg, balance, grade };
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Parent portal" subtitle={`Welcome, ${parent.nameEn}`} />

      <div className="grid gap-4 sm:grid-cols-2">
        {children.map((child) => {
          const st = childStats(child);
          return (
            <Card key={child.id}>
              <CardHeader>
                <CardTitle>{studentName(child)}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {st.grade?.nameEn} · {child.hasTransport ? 'Bus rider' : 'Own transport'}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Attendance" value={pct(st.attRate)} tone="text-accent-cool" />
                  <Stat label="Average" value={pct(st.avg)} tone="text-accent-cool" />
                  <Stat
                    label="Balance"
                    value={jod(st.balance)}
                    tone={st.balance > 0 ? 'text-accent-warm' : ''}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      actions.mockSend(
                        'EMAIL',
                        'registrar@munaxa-academy.edu.jo',
                        `Leave request for ${studentName(child)}`,
                      );
                      toast.success('Leave request submitted (demo only).');
                    }}
                  >
                    Request leave
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.success('Parent–teacher meeting slot booked (demo only).')}
                  >
                    Book PTM
                  </Button>
                  {st.balance > 0 ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        actions.mockSend(
                          'PAYMENT',
                          'CLIQ',
                          `Online fee payment for ${studentName(child)}`,
                        );
                        toast.success('Payment authorized (mocked — no real charge).');
                      }}
                    >
                      Pay fees
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest announcements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.announcements.slice(0, 4).map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0"
            >
              <span>
                <span className="font-medium">{a.titleEn}</span>{' '}
                <span className="text-muted-foreground">· {a.body}</span>
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {fmtDate(a.publishedAt)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-2">
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`font-display text-sm font-semibold ${tone ?? ''}`}>{value}</div>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useDemo } from '@/lib/demo-store/context';
import {
  financeSummary,
  attendanceRate,
  averageScore,
  enrollmentByGrade,
  gradeDistribution,
} from '@/lib/demo-store/selectors';
import { jod, pct, num } from '@/lib/format';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@axa/platform';
import { PageHeader, Gate } from '@/components/page';

type Kind = 'attendance' | 'academic' | 'financial';

export default function ReportsPage() {
  return (
    <Gate perm="report:read">
      <Reports />
    </Gate>
  );
}

function Reports() {
  const { data } = useDemo();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>('attendance');

  const report = useMemo(() => buildReport(kind, data), [kind, data]);

  function download() {
    const csv = [report.columns.join(','), ...report.rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `munaxa-${kind}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported (CSV generated in your browser).');
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Academic, attendance and financial summaries — generated entirely in your browser."
        actions={
          <>
            <Select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className="w-auto"
            >
              <option value="attendance">Attendance report</option>
              <option value="academic">Academic report</option>
              <option value="financial">Financial report</option>
            </Select>
            <Button onClick={download}>Export CSV</Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {report.kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                {k.label}
              </div>
              <div className="font-display text-xl font-semibold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{report.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                {report.columns.map((c) => (
                  <TH key={c} className={c !== report.columns[0] ? 'text-end' : ''}>
                    {c}
                  </TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {report.rows.map((row, i) => (
                <TR key={i}>
                  {row.map((cell, j) => (
                    <TD key={j} className={j === 0 ? '' : 'text-end font-mono'}>
                      {cell}
                    </TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function buildReport(kind: Kind, data: ReturnType<typeof useDemo>['data']) {
  if (kind === 'financial') {
    const f = financeSummary(data);
    const byDesc = new Map<string, { billed: number; collected: number }>();
    for (const inv of data.invoices) {
      const e = byDesc.get(inv.descriptionEn) ?? { billed: 0, collected: 0 };
      e.billed += inv.amount;
      e.collected += inv.paid;
      byDesc.set(inv.descriptionEn, e);
    }
    return {
      title: 'Revenue by fee type',
      kpis: [
        { label: 'Billed', value: jod(f.billed) },
        { label: 'Collected', value: jod(f.collected) },
        { label: 'Outstanding', value: jod(f.outstanding) },
        { label: 'Collection', value: pct(f.collectionRate) },
      ],
      columns: ['Fee type', 'Billed', 'Collected', 'Outstanding'],
      rows: [...byDesc.entries()].map(([desc, e]) => [
        desc,
        e.billed.toFixed(3),
        e.collected.toFixed(3),
        (e.billed - e.collected).toFixed(3),
      ]),
    };
  }
  if (kind === 'academic') {
    const dist = gradeDistribution(data);
    return {
      title: 'Enrolment & performance by grade',
      kpis: [
        { label: 'Students', value: num(data.students.length) },
        { label: 'Avg score', value: pct(averageScore(data)) },
        { label: 'A grades', value: num(dist.A ?? 0) },
        { label: 'F grades', value: num(dist.F ?? 0) },
      ],
      columns: ['Grade', 'Students'],
      rows: enrollmentByGrade(data).map((e) => [e.grade.nameEn, String(e.count)]),
    };
  }
  // attendance
  const byGrade = enrollmentByGrade(data).map((e) => {
    const ids = new Set(data.students.filter((s) => s.gradeId === e.grade.id).map((s) => s.id));
    const recs = data.attendance.filter((r) => ids.has(r.studentId));
    const present = recs.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    const rate = recs.length ? (present / recs.length) * 100 : 0;
    return [e.grade.nameEn, e.count.toString(), pct(rate)];
  });
  return {
    title: 'Attendance rate by grade',
    kpis: [
      { label: 'Overall rate', value: pct(attendanceRate(data)) },
      { label: 'Records', value: num(data.attendance.length) },
      { label: 'Students', value: num(data.students.length) },
      { label: 'Sections', value: num(data.sections.length) },
    ],
    columns: ['Grade', 'Students', 'Attendance'],
    rows: byGrade,
  };
}

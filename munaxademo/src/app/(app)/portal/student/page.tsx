'use client';

import { useMemo } from 'react';
import { useDemo } from '@/lib/demo-store/context';
import { studentName } from '@/lib/demo-store/selectors';
import { pct } from '@/lib/format';
import { PageHeader, Kpi } from '@/components/page';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  type Tone,
} from '@axa/platform';

const LETTER_TONE: Record<string, Tone> = {
  A: 'success',
  B: 'success',
  C: 'default',
  D: 'warning',
  F: 'danger',
};

export default function StudentPortalPage() {
  const { data } = useDemo();
  const student = useMemo(() => data.students[0]!, [data.students]);

  const grade = data.grades.find((g) => g.id === student.gradeId);
  const recs = data.attendance.filter((r) => r.studentId === student.id);
  const present = recs.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const attRate = recs.length ? (present / recs.length) * 100 : 0;
  const grades = data.grades_records.filter((g) => g.studentId === student.id);
  const avg = grades.length ? grades.reduce((s, g) => s + g.totalPct, 0) / grades.length : 0;
  const points = Math.round(avg * 12 + attRate * 5);

  const subjectName = (id: string) => data.subjects.find((s) => s.id === id)?.nameEn ?? id;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Student portal" subtitle={`${studentName(student)} · ${grade?.nameEn}`} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Attendance" value={pct(attRate)} tone="cool" />
        <Kpi label="Average" value={pct(avg)} tone="cool" />
        <Kpi label="Subjects" value={String(grades.length)} />
        <Kpi label="Reward points" value={String(points)} tone="primary" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>My grades — {data.school.term}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Subject</TH>
                <TH className="text-end">Classwork</TH>
                <TH className="text-end">Exam</TH>
                <TH className="text-end">Total</TH>
                <TH>Grade</TH>
              </TR>
            </THead>
            <TBody>
              {grades.map((g) => (
                <TR key={g.id}>
                  <TD>{subjectName(g.subjectId)}</TD>
                  <TD className="text-end font-mono">{g.classworkPct}</TD>
                  <TD className="text-end font-mono">{g.examPct}</TD>
                  <TD className="text-end font-mono">{g.totalPct}</TD>
                  <TD>
                    <Badge tone={LETTER_TONE[g.letter] ?? 'default'}>{g.letter}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Achievements</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {avg >= 85 ? <Badge tone="success">Honour roll</Badge> : null}
          {attRate >= 95 ? <Badge tone="success">Perfect attendance</Badge> : null}
          <Badge tone="default">Reading challenge</Badge>
          <Badge tone="warning">Science fair finalist</Badge>
          <Badge tone="muted">{points} reward points</Badge>
        </CardContent>
      </Card>
    </div>
  );
}

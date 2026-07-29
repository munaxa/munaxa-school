'use client';

import { useMemo, useState } from 'react';
import { useDemo } from '@/lib/demo-store/context';
import { studentName, gradeDistribution, averageScore } from '@/lib/demo-store/selectors';
import { pct } from '@/lib/format';
import { PageHeader, Gate, Bar } from '@/components/page';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Select,
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

export default function AcademicsPage() {
  return (
    <Gate perm="grade:read">
      <Academics />
    </Gate>
  );
}

function Academics() {
  const { data } = useDemo();
  const [sectionId, setSectionId] = useState(data.sections[0]!.id);
  const [subjectId, setSubjectId] = useState(data.subjects[0]!.id);

  const roster = data.students.filter((s) => s.sectionId === sectionId);
  const records = useMemo(() => {
    const ids = new Set(roster.map((s) => s.id));
    return data.grades_records.filter((g) => g.subjectId === subjectId && ids.has(g.studentId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.grades_records, subjectId, sectionId]);

  const dist = gradeDistribution(data);
  const distTotal = Object.values(dist).reduce((a, b) => a + b, 0);

  const sectionLabel = (id: string) => {
    const sec = data.sections.find((s) => s.id === id);
    const grade = data.grades.find((g) => g.id === sec?.gradeId);
    return `${grade?.nameEn ?? ''} — ${sec?.name ?? ''}`;
  };
  const nameOf = (sid: string) => {
    const s = data.students.find((st) => st.id === sid);
    return s ? studentName(s) : '—';
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Academics"
        subtitle={`${data.school.term} · school average ${pct(averageScore(data))}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Grade distribution (whole school)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-5">
          {(['A', 'B', 'C', 'D', 'F'] as const).map((l) => (
            <Bar
              key={l}
              label={`Grade ${l}`}
              n={dist[l] ?? 0}
              total={distTotal}
              className={
                l === 'F' ? 'bg-destructive' : l === 'D' ? 'bg-accent-warm' : 'bg-accent-cool'
              }
            />
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end gap-2">
        <Field label="Section">
          <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            {data.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {sectionLabel(s.id)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Subject">
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameEn}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Student</TH>
                <TH className="text-end">Classwork</TH>
                <TH className="text-end">Exam</TH>
                <TH className="text-end">Total</TH>
                <TH>Grade</TH>
              </TR>
            </THead>
            <TBody>
              {records.map((g) => (
                <TR key={g.id}>
                  <TD>{nameOf(g.studentId)}</TD>
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
    </div>
  );
}

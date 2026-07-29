'use client';

import { useMemo, useState } from 'react';
import { useDemo } from '@/lib/demo-store/context';
import { studentName } from '@/lib/demo-store/selectors';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@axa/platform';
import { PageHeader, Kpi } from '@/components/page';

function letterFor(total: number): string {
  if (total >= 90) return 'A';
  if (total >= 80) return 'B';
  if (total >= 70) return 'C';
  if (total >= 60) return 'D';
  return 'F';
}

export default function TeacherPortalPage() {
  const { data, actions } = useDemo();
  const toast = useToast();

  const teacher = useMemo(
    () => data.teachers.find((t) => t.homeroomSectionId) ?? data.teachers[0]!,
    [data.teachers],
  );
  const section =
    data.sections.find((s) => s.id === teacher.homeroomSectionId) ?? data.sections[0]!;
  const grade = data.grades.find((g) => g.id === section.gradeId);
  const roster = data.students.filter((s) => s.sectionId === section.id);

  const [subjectId, setSubjectId] = useState(teacher.subjectIds[0] ?? data.subjects[0]!.id);
  const [homework, setHomework] = useState('');

  function recordFor(studentId: string) {
    return data.grades_records.find((g) => g.studentId === studentId && g.subjectId === subjectId);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Teacher portal"
        subtitle={`${teacher.firstNameEn} ${teacher.familyEn} · Homeroom ${grade?.nameEn} ${section.name}`}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="My students" value={String(roster.length)} />
        <Kpi label="My subjects" value={String(teacher.subjectIds.length)} />
        <Kpi label="Sections taught" value={String(teacher.sectionIds.length)} />
        <Kpi label="Room" value={section.room} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Set homework</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              actions.mockSend('PUSH', `${grade?.nameEn} ${section.name}`, `Homework: ${homework}`);
              toast.success('Homework posted and families notified (mocked).');
              setHomework('');
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <Field label="Homework / task" className="flex-1">
              <Input
                value={homework}
                onChange={(e) => setHomework(e.target.value)}
                placeholder="Read chapter 4 and answer Q1–Q5"
                required
              />
            </Field>
            <Button type="submit">Post homework</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enter grades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Subject">
            <Select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-auto"
            >
              {data.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameEn}
                </option>
              ))}
            </Select>
          </Field>
          <Table>
            <THead>
              <TR>
                <TH>Student</TH>
                <TH className="text-end">Total %</TH>
                <TH>Grade</TH>
              </TR>
            </THead>
            <TBody>
              {roster.map((s) => {
                const rec = recordFor(s.id);
                return (
                  <TR key={s.id}>
                    <TD>{studentName(s)}</TD>
                    <TD className="text-end">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={rec?.totalPct ?? ''}
                        className="ms-auto h-8 w-24 text-end font-mono"
                        disabled={!rec}
                        onBlur={(e) => {
                          if (!rec) return;
                          const total = Math.max(0, Math.min(100, Number(e.target.value)));
                          actions.updateGrade(rec.id, {
                            totalPct: total,
                            letter: letterFor(total),
                          });
                          toast.success(`${studentName(s)}: ${total}% saved (demo only).`);
                        }}
                      />
                    </TD>
                    <TD>{rec?.letter ?? '—'}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

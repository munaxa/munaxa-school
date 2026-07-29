'use client';

import { useMemo, useState } from 'react';
import { useDemo } from '@/lib/demo-store/context';
import { useSession } from '@/lib/session-context';
import { studentName } from '@/lib/demo-store/selectors';
import { fmtDate, pct } from '@/lib/format';
import {
  Badge,
  Button,
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
  useToast,
} from '@axa/platform';
import { PageHeader, Gate, Bar } from '@/components/page';
import type { AttendanceStatus } from '@/seed/types';

const STATUSES: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];
const TONE: Record<AttendanceStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'danger',
  EXCUSED: 'default',
};

export default function AttendancePage() {
  return (
    <Gate perm="attendance:read">
      <Attendance />
    </Gate>
  );
}

function Attendance() {
  const { data, actions } = useDemo();
  const { can } = useSession();
  const toast = useToast();
  const canMark = can('attendance:create');

  const dates = useMemo(
    () => [...new Set(data.attendance.map((r) => r.date))].sort().reverse(),
    [data.attendance],
  );
  const [sectionId, setSectionId] = useState(data.sections[0]!.id);
  const [date, setDate] = useState(dates[0] ?? new Date().toISOString().slice(0, 10));
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});

  const roster = data.students.filter((s) => s.sectionId === sectionId);
  const statusFor = (studentId: string): AttendanceStatus => {
    if (draft[studentId]) return draft[studentId]!;
    const rec = data.attendance.find((r) => r.studentId === studentId && r.date === date);
    return rec?.status ?? 'PRESENT';
  };

  const summary = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 };
    for (const s of roster) counts[statusFor(s.id)] += 1;
    const total = roster.length;
    return { counts, total, rate: total ? ((counts.PRESENT + counts.LATE) / total) * 100 : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, draft, date, data.attendance]);

  function save() {
    const records = roster.map((s) => ({ studentId: s.id, date, status: statusFor(s.id) }));
    actions.setAttendance(records);
    setDraft({});
    toast.success(
      `Attendance saved for ${roster.length} students on ${fmtDate(date)} (demo only).`,
    );
  }

  const sectionLabel = (id: string) => {
    const sec = data.sections.find((s) => s.id === id);
    const grade = data.grades.find((g) => g.id === sec?.gradeId);
    return `${grade?.nameEn ?? ''} — ${sec?.name ?? ''}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Attendance"
        subtitle="Mark daily homeroom attendance and review history."
      />

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
        <Field label="Date">
          <Select value={date} onChange={(e) => setDate(e.target.value)}>
            {dates.map((d) => (
              <option key={d} value={d}>
                {fmtDate(d)}
              </option>
            ))}
          </Select>
        </Field>
        {canMark ? (
          <Button onClick={save} disabled={Object.keys(draft).length === 0}>
            Save attendance
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {sectionLabel(sectionId)} · {pct(summary.rate)} present
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Bar
            label="Present"
            n={summary.counts.PRESENT}
            total={summary.total}
            className="bg-accent-cool"
          />
          <Bar
            label="Late"
            n={summary.counts.LATE}
            total={summary.total}
            className="bg-accent-warm"
          />
          <Bar
            label="Absent"
            n={summary.counts.ABSENT}
            total={summary.total}
            className="bg-destructive"
          />
          <Bar
            label="Excused"
            n={summary.counts.EXCUSED}
            total={summary.total}
            className="bg-primary"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Student</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {roster.map((s) => {
                const status = statusFor(s.id);
                return (
                  <TR key={s.id}>
                    <TD>{studentName(s)}</TD>
                    <TD>
                      {canMark ? (
                        <Select
                          value={status}
                          className="h-8 w-36"
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [s.id]: e.target.value as AttendanceStatus }))
                          }
                        >
                          {STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Badge tone={TONE[status]}>{status}</Badge>
                      )}
                    </TD>
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

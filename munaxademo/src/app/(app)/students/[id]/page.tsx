'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useDemo } from '@/lib/demo-store/context';
import { studentName, studentNameAr } from '@/lib/demo-store/selectors';
import { jod, fmtDate, pct, num } from '@/lib/format';
import { Gate, Bar } from '@/components/page';
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
import type { AttendanceStatus, InvoiceStatus } from '@/seed/types';

const CHARGE_TONE: Record<InvoiceStatus, Tone> = {
  PAID: 'success',
  PARTIAL: 'warning',
  OVERDUE: 'danger',
  PENDING: 'default',
};
const LETTER_TONE: Record<string, Tone> = {
  A: 'success',
  B: 'success',
  C: 'default',
  D: 'warning',
  F: 'danger',
};

export default function StudentProfilePage() {
  return (
    <Gate perm="student:manage">
      <StudentProfile />
    </Gate>
  );
}

function StudentProfile() {
  const params = useParams<{ id: string }>();
  const { data } = useDemo();
  const student = data.students.find((s) => s.id === params.id);

  const derived = useMemo(() => {
    if (!student) return null;
    const grade = data.grades.find((g) => g.id === student.gradeId);
    const section = data.sections.find((s) => s.id === student.sectionId);
    const parents = student.parentIds
      .map((id) => data.parents.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    const homeroom = data.teachers.find((t) => t.homeroomSectionId === student.sectionId);

    const invoices = data.invoices.filter((i) => i.studentId === student.id);
    const payments = data.payments.filter((p) => p.studentId === student.id);
    const charged = invoices.reduce((s, i) => s + i.amount, 0);
    const paid = invoices.reduce((s, i) => s + i.paid, 0);
    const outstanding = charged - paid;
    const overdue = invoices
      .filter((i) => i.status === 'OVERDUE')
      .reduce((s, i) => s + (i.amount - i.paid), 0);

    const attendance = data.attendance.filter((r) => r.studentId === student.id);
    const counts: Record<AttendanceStatus, number> = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 };
    for (const r of attendance) counts[r.status] += 1;
    const attRate = attendance.length
      ? ((counts.PRESENT + counts.LATE) / attendance.length) * 100
      : 0;

    const grades = data.grades_records.filter((g) => g.studentId === student.id);
    const avg = grades.length ? grades.reduce((s, g) => s + g.totalPct, 0) / grades.length : 0;

    const route = student.hasTransport
      ? data.routes.find((r) => r.studentIds.includes(student.id))
      : undefined;

    return {
      grade,
      section,
      parents,
      homeroom,
      invoices,
      payments,
      charged,
      paid,
      outstanding,
      overdue,
      attendance,
      counts,
      attRate,
      grades,
      avg,
      route,
    };
  }, [student, data]);

  if (!student || !derived) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Student not found.{' '}
            <Link href={'/students' as never} className="text-primary-strong hover:underline">
              Back to students
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = `${student.firstNameEn[0] ?? ''}${student.familyEn[0] ?? ''}`.toUpperCase();
  const subjectName = (id: string) => data.subjects.find((s) => s.id === id)?.nameEn ?? id;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={'/students' as never}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Students
        </Link>
        <span className="font-mono text-xs text-muted-foreground">{student.studentNo}</span>
      </div>

      {/* Identity header */}
      <Card>
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary font-display text-2xl font-semibold text-primary-foreground shadow-glow">
            {initials}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="font-display text-2xl font-semibold">{studentName(student)}</h1>
              <span className="font-display text-lg text-muted-foreground" dir="rtl">
                {studentNameAr(student)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={student.status === 'ACTIVE' ? 'success' : 'muted'}>
                {student.status}
              </Badge>
              <Badge tone="default">
                {derived.grade?.nameEn} · {derived.section?.name}
              </Badge>
              {student.hasTransport ? <Badge tone="muted">Bus rider</Badge> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Identity details */}
      <Card>
        <CardHeader>
          <CardTitle>Student details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Detail label="MoE student no." value={student.studentNo} mono />
          <Detail label="National ID" value={student.nationalId} mono />
          <Detail label="QR / Card" value={`STU-${student.studentNo}`} mono />
          <Detail label="Date of birth" value={fmtDate(student.dob)} mono />
          <Detail label="Gender" value={student.gender === 'M' ? 'Male' : 'Female'} />
          <Detail label="Admission date" value={fmtDate(student.admissionDate)} mono />
          <Detail label="Grade" value={derived.grade?.nameEn ?? '—'} />
          <Detail
            label="Section"
            value={`${derived.section?.name ?? '—'} · Room ${derived.section?.room ?? '—'}`}
          />
          <Detail
            label="Homeroom teacher"
            value={
              derived.homeroom
                ? `${derived.homeroom.firstNameEn} ${derived.homeroom.familyEn}`
                : '—'
            }
          />
          <Detail
            label="Transport"
            value={student.hasTransport ? (derived.route?.nameEn ?? 'Assigned') : 'Own transport'}
          />
          <Detail
            label="Guardians"
            value={derived.parents.map((p) => `${p.nameEn} (${p.relation})`).join(', ') || '—'}
            wide
          />
        </CardContent>
      </Card>

      {/* Finance — student card */}
      <Card className={derived.outstanding > 0 ? 'border-accent-warm/40' : ''}>
        <CardHeader>
          <CardTitle>Finance</CardTitle>
          {derived.outstanding > 0 ? (
            <p className="text-sm text-muted-foreground">
              Outstanding{' '}
              <strong className="font-mono text-accent-warm">{jod(derived.outstanding)}</strong>
              {derived.overdue > 0 ? (
                <>
                  {' · '}overdue{' '}
                  <strong className="font-mono text-destructive">{jod(derived.overdue)}</strong>
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">All fees settled.</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Charged" value={derived.charged.toFixed(3)} />
            <Kpi label="Paid" value={derived.paid.toFixed(3)} tone="text-accent-cool" />
            <Kpi label="Discounts" value={(0).toFixed(3)} />
            <Kpi
              label="Outstanding"
              value={derived.outstanding.toFixed(3)}
              tone="text-accent-warm"
            />
            <Kpi label="Credit" value={(0).toFixed(3)} tone="text-accent-cool" />
            <Kpi label="Refunded" value={(0).toFixed(3)} />
          </div>

          <Table>
            <THead>
              <TR>
                <TH>Description</TH>
                <TH className="text-end">Gross</TH>
                <TH className="text-end">Discount</TH>
                <TH className="text-end">Net</TH>
                <TH className="text-end">Balance</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {derived.invoices.map((inv) => (
                <TR key={inv.id}>
                  <TD>
                    {inv.descriptionEn} · <span dir="rtl">{inv.descriptionAr}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      due {fmtDate(inv.dueDate)}
                    </span>
                  </TD>
                  <TD className="text-end font-mono">{inv.amount.toFixed(3)}</TD>
                  <TD className="text-end font-mono">0.000</TD>
                  <TD className="text-end font-mono">{inv.amount.toFixed(3)}</TD>
                  <TD className="text-end font-mono">{(inv.amount - inv.paid).toFixed(3)}</TD>
                  <TD>
                    <Badge tone={CHARGE_TONE[inv.status]}>{inv.status}</Badge>
                  </TD>
                </TR>
              ))}
              {derived.invoices.length === 0 ? (
                <TR>
                  <TD colSpan={6} className="text-muted-foreground">
                    No charges.
                  </TD>
                </TR>
              ) : null}
            </TBody>
          </Table>

          {derived.payments.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH className="text-end">Amount</TH>
                  <TH>Method</TH>
                  <TH>Date</TH>
                  <TH>Reference</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {derived.payments.map((p) => (
                  <TR key={p.id}>
                    <TD className="text-end font-mono">{p.amount.toFixed(3)}</TD>
                    <TD>{p.method.replace('_', ' ')}</TD>
                    <TD className="font-mono text-xs">{fmtDate(p.paidAt)}</TD>
                    <TD className="font-mono text-xs text-muted-foreground">{p.reference}</TD>
                    <TD>
                      <Badge tone="success">VERIFIED</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Attendance */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance</CardTitle>
            <p className="text-sm text-muted-foreground">
              {pct(derived.attRate)} present · {num(derived.attendance.length)} days recorded
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <Bar
              label="Present"
              n={derived.counts.PRESENT}
              total={derived.attendance.length}
              className="bg-accent-cool"
            />
            <Bar
              label="Late"
              n={derived.counts.LATE}
              total={derived.attendance.length}
              className="bg-accent-warm"
            />
            <Bar
              label="Absent"
              n={derived.counts.ABSENT}
              total={derived.attendance.length}
              className="bg-destructive"
            />
            <Bar
              label="Excused"
              n={derived.counts.EXCUSED}
              total={derived.attendance.length}
              className="bg-primary"
            />
          </CardContent>
        </Card>

        {/* Academics */}
        <Card>
          <CardHeader>
            <CardTitle>Academics</CardTitle>
            <p className="text-sm text-muted-foreground">
              {data.school.term} · average {pct(derived.avg)}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Subject</TH>
                  <TH className="text-end">Total</TH>
                  <TH>Grade</TH>
                </TR>
              </THead>
              <TBody>
                {derived.grades.map((g) => (
                  <TR key={g.id}>
                    <TD>{subjectName(g.subjectId)}</TD>
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

      <p className="text-center text-xs text-muted-foreground">
        Numbers, IDs and money are shown LTR in mono per the Munaxa design system.
      </p>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  wide,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-2 sm:col-span-3' : ''}>
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`text-sm ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`font-display text-lg font-semibold ${tone ?? ''}`}>{value}</div>
    </div>
  );
}

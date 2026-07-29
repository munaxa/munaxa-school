/** Pure derivations over the working dataset — KPIs, rates and rollups for the
 *  dashboards, analytics and reports. No side effects. */
import type { Baseline, AttendanceStatus, Student } from '@/seed/types';

export function studentName(s: Student): string {
  return `${s.firstNameEn} ${s.fatherNameEn} ${s.familyEn}`;
}
export function studentNameAr(s: Student): string {
  return `${s.firstNameAr} ${s.familyAr}`;
}

export function financeSummary(b: Baseline) {
  let billed = 0;
  let collected = 0;
  let outstanding = 0;
  let overdue = 0;
  for (const inv of b.invoices) {
    billed += inv.amount;
    collected += inv.paid;
    const bal = inv.amount - inv.paid;
    outstanding += bal;
    if (inv.status === 'OVERDUE') overdue += bal;
  }
  return {
    billed,
    collected,
    outstanding,
    overdue,
    collectionRate: billed ? (collected / billed) * 100 : 0,
  };
}

export function attendanceToday(b: Baseline) {
  const latest = b.attendance.reduce((m, r) => (r.date > m ? r.date : m), '');
  const today = b.attendance.filter((r) => r.date === latest);
  const counts: Record<AttendanceStatus, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  for (const r of today) counts[r.status] += 1;
  const total = today.length;
  const rate = total ? ((counts.PRESENT + counts.LATE) / total) * 100 : 0;
  return { date: latest, total, counts, rate };
}

export function attendanceRate(b: Baseline): number {
  if (!b.attendance.length) return 0;
  const present = b.attendance.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  return (present / b.attendance.length) * 100;
}

export function gradeDistribution(b: Baseline) {
  const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const g of b.grades_records) dist[g.letter] = (dist[g.letter] ?? 0) + 1;
  return dist;
}

export function averageScore(b: Baseline): number {
  if (!b.grades_records.length) return 0;
  return b.grades_records.reduce((s, g) => s + g.totalPct, 0) / b.grades_records.length;
}

export function enrollmentByGrade(b: Baseline) {
  return b.grades.map((g) => ({
    grade: g,
    count: b.students.filter((s) => s.gradeId === g.id).length,
  }));
}

export function topOutstanding(b: Baseline, n = 8) {
  const byStudent = new Map<string, number>();
  for (const inv of b.invoices) {
    const bal = inv.amount - inv.paid;
    if (bal > 0) byStudent.set(inv.studentId, (byStudent.get(inv.studentId) ?? 0) + bal);
  }
  return [...byStudent.entries()]
    .map(([studentId, balance]) => ({
      student: b.students.find((s) => s.id === studentId),
      balance,
    }))
    .filter((x) => x.student)
    .sort((a, b2) => b2.balance - a.balance)
    .slice(0, n);
}

export function kpis(b: Baseline) {
  const fin = financeSummary(b);
  const att = attendanceToday(b);
  return {
    students: b.students.length,
    parents: b.parents.length,
    teachers: b.teachers.length,
    staff: b.staff.length,
    sections: b.sections.length,
    attendanceToday: att.rate,
    outstanding: fin.outstanding,
    collected: fin.collected,
    admissionsOpen: b.admissions.filter((a) => !['ENROLLED', 'REJECTED'].includes(a.stage)).length,
    booksOnLoan: b.loans.filter((l) => l.status !== 'RETURNED').length,
    buses: b.buses.length,
    avgScore: averageScore(b),
  };
}

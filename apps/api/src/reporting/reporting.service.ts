import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReportingRepository, type DateRange, type ReportStudent } from './reporting.repository';
import type { ReportTable } from './export/report.types';

export interface ReportFilters {
  sectionId?: string;
  from?: string;
  to?: string;
  semesterId?: string;
}

@Injectable()
export class ReportingService {
  constructor(private readonly repo: ReportingRepository) {}

  private name(s: ReportStudent): string {
    return `${s.firstNameEn} ${s.lastNameEn}`.trim();
  }

  private range(filters: ReportFilters): DateRange {
    return {
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
    };
  }

  private rangeLabel(filters: ReportFilters): string {
    const parts: string[] = [];
    if (filters.sectionId) parts.push(`section ${filters.sectionId}`);
    if (filters.from || filters.to) {
      parts.push(`${filters.from ?? '…'} → ${filters.to ?? '…'}`);
    }
    return parts.length ? parts.join(', ') : 'all students';
  }

  // ----- Attendance ----------------------------------------------------------
  async attendance(filters: ReportFilters): Promise<ReportTable> {
    const students = await this.repo.students(filters.sectionId);
    const ids = students.map((s) => s.id);
    const counts = ids.length ? await this.repo.attendanceCounts(ids, this.range(filters)) : [];

    const byStudent = new Map<string, Record<string, number>>();
    for (const c of counts) {
      const row = byStudent.get(c.studentId) ?? {};
      row[c.status] = c._count._all;
      byStudent.set(c.studentId, row);
    }

    const rows = students.map((s) => {
      const c = byStudent.get(s.id) ?? {};
      const present = c.PRESENT ?? 0;
      const absent = c.ABSENT ?? 0;
      const late = c.LATE ?? 0;
      const excused = c.EXCUSED ?? 0;
      const total = present + absent + late + excused;
      const rate = total === 0 ? 0 : Math.round(((present + late) / total) * 1000) / 10;
      return {
        studentId: s.id,
        student: this.name(s),
        present,
        absent,
        late,
        excused,
        total,
        attendanceRate: `${rate}%`,
      };
    });

    return {
      title: 'Attendance Report',
      subtitle: this.rangeLabel(filters),
      columns: [
        { key: 'student', header: 'Student' },
        { key: 'present', header: 'Present' },
        { key: 'absent', header: 'Absent' },
        { key: 'late', header: 'Late' },
        { key: 'excused', header: 'Excused' },
        { key: 'total', header: 'Total' },
        { key: 'attendanceRate', header: 'Attendance %' },
      ],
      rows,
      generatedAt: new Date().toISOString(),
    };
  }

  // ----- Academic ------------------------------------------------------------
  async academic(filters: ReportFilters): Promise<ReportTable> {
    const students = await this.repo.students(filters.sectionId);
    const ids = students.map((s) => s.id);
    const records = ids.length
      ? await this.repo.gradeRecords(ids, {
          sectionId: filters.sectionId,
          semesterId: filters.semesterId,
        })
      : [];

    const agg = new Map<string, { count: number; sumPercent: number }>();
    for (const r of records) {
      const max = Number(r.maxScore);
      if (max <= 0) continue;
      const percent = (Number(r.score) / max) * 100;
      const a = agg.get(r.studentId) ?? { count: 0, sumPercent: 0 };
      a.count += 1;
      a.sumPercent += percent;
      agg.set(r.studentId, a);
    }

    const rows = students.map((s) => {
      const a = agg.get(s.id) ?? { count: 0, sumPercent: 0 };
      const avg = a.count === 0 ? 0 : Math.round((a.sumPercent / a.count) * 10) / 10;
      return {
        studentId: s.id,
        student: this.name(s),
        assessments: a.count,
        averagePercent: `${avg}%`,
      };
    });

    return {
      title: 'Academic Report',
      subtitle: this.rangeLabel(filters),
      columns: [
        { key: 'student', header: 'Student' },
        { key: 'assessments', header: 'Assessments' },
        { key: 'averagePercent', header: 'Average %' },
      ],
      rows,
      generatedAt: new Date().toISOString(),
    };
  }

  // ----- Financial -----------------------------------------------------------
  async financial(filters: ReportFilters): Promise<ReportTable> {
    const students = await this.repo.students(filters.sectionId);
    const ids = students.map((s) => s.id);
    const [charges, payments] = ids.length
      ? await Promise.all([this.repo.chargeSums(ids), this.repo.verifiedPaymentSums(ids)])
      : [[], []];

    const charged = new Map<string, Prisma.Decimal>();
    for (const c of charges) charged.set(c.studentId, c._sum.amount ?? new Prisma.Decimal(0));
    const paid = new Map<string, Prisma.Decimal>();
    for (const p of payments) paid.set(p.studentId, p._sum.amount ?? new Prisma.Decimal(0));

    const rows = students.map((s) => {
      const c = charged.get(s.id) ?? new Prisma.Decimal(0);
      const p = paid.get(s.id) ?? new Prisma.Decimal(0);
      return {
        studentId: s.id,
        student: this.name(s),
        charged: c.toFixed(3),
        paid: p.toFixed(3),
        outstanding: c.minus(p).toFixed(3),
      };
    });

    return {
      title: 'Financial Report',
      subtitle: this.rangeLabel(filters),
      columns: [
        { key: 'student', header: 'Student' },
        { key: 'charged', header: 'Charged (JOD)' },
        { key: 'paid', header: 'Paid (JOD)' },
        { key: 'outstanding', header: 'Outstanding (JOD)' },
      ],
      rows,
      generatedAt: new Date().toISOString(),
    };
  }

  // ----- Behavior ------------------------------------------------------------
  async behavior(filters: ReportFilters): Promise<ReportTable> {
    const students = await this.repo.students(filters.sectionId);
    const ids = students.map((s) => s.id);
    const counts = ids.length ? await this.repo.behaviorCounts(ids, this.range(filters)) : [];

    const byStudent = new Map<
      string,
      { POSITIVE: number; NEGATIVE: number; NEUTRAL: number; points: number }
    >();
    for (const c of counts) {
      const row = byStudent.get(c.studentId) ?? { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, points: 0 };
      row[c.type] = c._count._all;
      row.points += c._sum.points ?? 0;
      byStudent.set(c.studentId, row);
    }

    const rows = students.map((s) => {
      const c = byStudent.get(s.id) ?? { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, points: 0 };
      return {
        studentId: s.id,
        student: this.name(s),
        positive: c.POSITIVE,
        negative: c.NEGATIVE,
        neutral: c.NEUTRAL,
        total: c.POSITIVE + c.NEGATIVE + c.NEUTRAL,
        netPoints: c.points,
      };
    });

    return {
      title: 'Behavior Report',
      subtitle: this.rangeLabel(filters),
      columns: [
        { key: 'student', header: 'Student' },
        { key: 'positive', header: 'Positive' },
        { key: 'negative', header: 'Negative' },
        { key: 'neutral', header: 'Neutral' },
        { key: 'total', header: 'Total' },
        { key: 'netPoints', header: 'Net Points' },
      ],
      rows,
      generatedAt: new Date().toISOString(),
    };
  }
}

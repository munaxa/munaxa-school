import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import type { GradeRecord } from '@prisma/client';
import { GradeRepository, type UpsertGrade } from './grade.repository';
import { TenantContextStore } from '../../prisma/tenant-context';
import type { CreateGradeDto, ImportGradesDto } from './grade.dto';

export interface ImportResult {
  imported: number;
  failed: Array<{ row: number; error: string }>;
}

export interface SubjectReport {
  subject: string;
  count: number;
  averagePercent: number;
}

export interface GradeReport {
  studentId: string;
  semesterId: string | null;
  subjects: SubjectReport[];
  overallPercent: number;
}

@Injectable()
export class GradeService {
  constructor(private readonly repo: GradeRepository) {}

  async create(dto: CreateGradeDto): Promise<GradeRecord> {
    if (!(await this.repo.studentExists(dto.studentId))) {
      throw new BadRequestException('Student not found in this tenant');
    }
    if (dto.score > dto.maxScore) {
      throw new BadRequestException('score cannot exceed maxScore');
    }
    return this.repo.upsert(this.toUpsert(dto));
  }

  list(studentId: string, semesterId?: string): Promise<GradeRecord[]> {
    return this.repo.findForStudent(studentId, semesterId);
  }

  // ----- Grade import engine (CSV) -----------------------------------------
  async importCsv(dto: ImportGradesDto): Promise<ImportResult> {
    let records: Record<string, string>[];
    try {
      records = parse(dto.csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<
        string,
        string
      >[];
    } catch {
      throw new BadRequestException('Could not parse CSV');
    }
    if (records.length === 0) throw new BadRequestException('CSV contains no data rows');

    const failed: ImportResult['failed'] = [];
    const valid: UpsertGrade[] = [];

    records.forEach((record, index) => {
      const row = index + 2; // 1-based + header
      const { studentId, subject, assessment } = record;
      const score = Number(record.score);
      const maxScore = Number(record.maxScore);
      if (!studentId || !subject || !assessment) {
        failed.push({ row, error: 'Missing studentId/subject/assessment' });
        return;
      }
      if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
        failed.push({ row, error: 'Invalid score/maxScore' });
        return;
      }
      if (score > maxScore) {
        failed.push({ row, error: 'score exceeds maxScore' });
        return;
      }
      valid.push({
        studentId,
        subject,
        assessment,
        score,
        maxScore,
        sectionId: record.sectionId || null,
        semesterId: record.semesterId || null,
        weight: record.weight ? Number(record.weight) : null,
        gradedById: TenantContextStore.get()?.actorUserId ?? null,
      });
    });

    let imported = 0;
    for (const grade of valid) {
      try {
        await this.repo.upsert(grade);
        imported += 1;
      } catch {
        failed.push({ row: -1, error: `Failed to import grade for ${grade.studentId}` });
      }
    }
    return { imported, failed };
  }

  // ----- Grade report ------------------------------------------------------
  async report(studentId: string, semesterId?: string): Promise<GradeReport> {
    if (!(await this.repo.studentExists(studentId))) {
      throw new NotFoundException('Student not found');
    }
    const grades = await this.repo.findForStudent(studentId, semesterId);
    const bySubject = new Map<string, { sumPercent: number; count: number }>();
    for (const grade of grades) {
      const percent = (Number(grade.score) / Number(grade.maxScore)) * 100;
      const entry = bySubject.get(grade.subject) ?? { sumPercent: 0, count: 0 };
      entry.sumPercent += percent;
      entry.count += 1;
      bySubject.set(grade.subject, entry);
    }

    const subjects: SubjectReport[] = [...bySubject.entries()].map(([subject, e]) => ({
      subject,
      count: e.count,
      averagePercent: round2(e.sumPercent / e.count),
    }));
    const overallPercent =
      subjects.length === 0
        ? 0
        : round2(subjects.reduce((sum, s) => sum + s.averagePercent, 0) / subjects.length);

    return { studentId, semesterId: semesterId ?? null, subjects, overallPercent };
  }

  private toUpsert(dto: CreateGradeDto): UpsertGrade {
    return {
      studentId: dto.studentId,
      subject: dto.subject,
      assessment: dto.assessment,
      score: dto.score,
      maxScore: dto.maxScore,
      sectionId: dto.sectionId ?? null,
      semesterId: dto.semesterId ?? null,
      weight: dto.weight ?? null,
      gradedById: TenantContextStore.get()?.actorUserId ?? null,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

import { Injectable } from '@nestjs/common';
import type { GradeRecord } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

export interface UpsertGrade {
  studentId: string;
  subject: string;
  assessment: string;
  score: number;
  maxScore: number;
  sectionId: string | null;
  semesterId: string | null;
  weight: number | null;
  gradedById: string | null;
}

@Injectable()
export class GradeRepository extends TenantRepository {
  /**
   * Idempotent upsert on (tenantId, studentId, subject, assessment, semesterId). The unique
   * has a nullable semesterId, so we use findFirst + update/create rather than a compound upsert.
   */
  upsert(grade: UpsertGrade): Promise<GradeRecord> {
    return this.run(async (tx, tenantId) => {
      const existing = await tx.gradeRecord.findFirst({
        where: {
          studentId: grade.studentId,
          subject: grade.subject,
          assessment: grade.assessment,
          semesterId: grade.semesterId,
        },
      });
      if (existing) {
        return tx.gradeRecord.update({
          where: { id: existing.id },
          data: {
            score: grade.score,
            maxScore: grade.maxScore,
            weight: grade.weight,
            sectionId: grade.sectionId,
            gradedById: grade.gradedById,
          },
        });
      }
      return tx.gradeRecord.create({ data: { ...grade, tenantId } });
    });
  }

  findForStudent(studentId: string, semesterId?: string): Promise<GradeRecord[]> {
    return this.run((tx) =>
      tx.gradeRecord.findMany({
        where: { studentId, ...(semesterId ? { semesterId } : {}) },
        orderBy: [{ subject: 'asc' }, { assessment: 'asc' }],
      }),
    );
  }

  studentExists(studentId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.student.findFirst({ where: { id: studentId, deletedAt: null } })) !== null,
    );
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma, YearEndAction, YearEndProcessStatus } from '@prisma/client';
import { TenantRepository } from '../common/tenant.repository';
import { TenantContextStore } from '../prisma/tenant-context';

/** Data access for Year-End Processing (Decisions 9 & 10). Drafting decisions writes NO enrollment. */
@Injectable()
export class YearEndRepository extends TenantRepository {
  private actor(): string | null {
    return TenantContextStore.get()?.actorUserId ?? null;
  }

  academicYear(id: string) {
    return this.run((tx) =>
      tx.academicYear.findFirst({
        where: { id },
        select: { id: true, schoolId: true, status: true, name: true },
      }),
    );
  }

  openProcessForSource(sourceAcademicYearId: string) {
    return this.run((tx) =>
      tx.yearEndProcess.findFirst({
        where: { sourceAcademicYearId, status: YearEndProcessStatus.OPEN },
      }),
    );
  }

  /**
   * Create the process and seed one DECIDE_LATER decision per actively-participating student in the
   * source year. `needsReview` is highlighted for students with no grade records (missing grades) so
   * the board never silently promotes them (Decision 9). No enrollment/finance is created.
   */
  createProcessWithBoard(input: {
    schoolId: string;
    sourceAcademicYearId: string;
    targetAcademicYearId: string;
  }) {
    return this.run(async (tx, tenantId) => {
      const process = await tx.yearEndProcess.create({
        data: {
          tenantId,
          schoolId: input.schoolId,
          sourceAcademicYearId: input.sourceAcademicYearId,
          targetAcademicYearId: input.targetAcademicYearId,
          createdById: this.actor(),
        },
      });

      const enrollments = await tx.enrollment.findMany({
        where: { academicYearId: input.sourceAcademicYearId, status: 'ACTIVE' },
        select: { id: true, studentId: true },
      });

      if (enrollments.length > 0) {
        const studentIds = enrollments.map((e) => e.studentId);
        const withGrades = await tx.gradeRecord.groupBy({
          by: ['studentId'],
          where: { studentId: { in: studentIds } },
          _count: { _all: true },
        });
        const gradedStudents = new Set(withGrades.map((g) => g.studentId));

        await tx.yearEndDecision.createMany({
          data: enrollments.map((e) => ({
            tenantId,
            processId: process.id,
            studentId: e.studentId,
            sourceEnrollmentId: e.id,
            action: YearEndAction.DECIDE_LATER,
            needsReview: !gradedStudents.has(e.studentId),
            ...(gradedStudents.has(e.studentId)
              ? {}
              : { reviewNote: 'No grade records for the year' }),
          })),
        });
      }

      await this.writeAudit(tx, tenantId, {
        action: 'yearEnd.open',
        entityType: 'YearEndProcess',
        entityId: process.id,
        metadata: { seeded: enrollments.length },
      });
      return process;
    });
  }

  getProcess(processId: string) {
    return this.run((tx) => tx.yearEndProcess.findFirst({ where: { id: processId } }));
  }

  /** The review board (studentId is a plain ref; identity is joined in via studentsByIds). */
  listDecisions(processId: string) {
    return this.run((tx) =>
      tx.yearEndDecision.findMany({ where: { processId }, orderBy: { createdAt: 'asc' } }),
    );
  }

  studentsByIds(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return this.run((tx) =>
      tx.student.findMany({
        where: { id: { in: ids } },
        select: { id: true, studentNumber: true, firstNameEn: true, lastNameEn: true },
      }),
    );
  }

  getDecision(decisionId: string) {
    return this.run((tx) => tx.yearEndDecision.findFirst({ where: { id: decisionId } }));
  }

  updateDecision(decisionId: string, data: Prisma.YearEndDecisionUpdateInput) {
    return this.run((tx) => tx.yearEndDecision.update({ where: { id: decisionId }, data }));
  }

  /** The Financial Account (Payer) a student is billed through — used to promote via the shared pipeline. */
  studentFinancialAccountId(studentId: string): Promise<string | null> {
    return this.run(async (tx) => {
      const acc = await tx.studentFinancialAccount.findFirst({
        where: { studentId },
        select: { payerId: true },
      });
      return acc?.payerId ?? null;
    });
  }

  markProcessCommitted(processId: string) {
    return this.run((tx, tenantId) =>
      tx.yearEndProcess
        .update({
          where: { id: processId },
          data: {
            status: YearEndProcessStatus.COMMITTED,
            committedById: this.actor(),
            committedAt: new Date(),
          },
        })
        .then(async (p) => {
          await this.writeAudit(tx, tenantId, {
            action: 'yearEnd.commit',
            entityType: 'YearEndProcess',
            entityId: processId,
          });
          return p;
        }),
    );
  }

  cancelProcess(processId: string) {
    return this.run((tx) =>
      tx.yearEndProcess.update({
        where: { id: processId },
        data: { status: YearEndProcessStatus.CANCELLED },
      }),
    );
  }
}

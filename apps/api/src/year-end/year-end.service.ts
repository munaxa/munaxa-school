import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  EnrollmentStatus,
  QuotePaymentMode,
  YearEndAction,
  YearEndProcessStatus,
} from '@prisma/client';
import { YearEndRepository } from './year-end.repository';
import type { OpenYearEndDto, SetDecisionDto } from './year-end.dto';
import { AdmissionsService } from '../finance/admissions/admissions.service';
import { QuoteService } from '../finance/admissions/quote.service';
import { AddFamilyStudentMode } from '../finance/admissions/admissions.dto';
import { EnrollmentLifecycleService } from '../people/enrollment-lifecycle/enrollment-lifecycle.service';

// Default installment count for auto-generated promotion plans (schools typically bill ~9 months).
// The registrar can adjust the plan afterwards from the Financial Account.
const PROMOTION_INSTALLMENTS = 9;

/**
 * Year-End Processing wizard (Decisions 9 & 10). PREVIEW → FINAL CONFIRM: opening a run and drafting
 * decisions creates NOTHING in the enrollment/finance domain — only `commit` does, and only for the
 * chosen actions. Promotion/repeat reuse the shared enrollment pipeline (a NEW enrollment in the next
 * year; history is never modified — Decision 12); graduate/withdraw use the lifecycle service. Commit
 * is resumable and idempotent per student, so a single failure never blocks the rest of the batch.
 */
@Injectable()
export class YearEndProcessingService {
  private readonly logger = new Logger(YearEndProcessingService.name);

  constructor(
    private readonly repo: YearEndRepository,
    private readonly admissions: AdmissionsService,
    private readonly quotes: QuoteService,
    private readonly lifecycle: EnrollmentLifecycleService,
  ) {}

  /** Step 1-3: open a run and build the review board over the source year's active students. */
  async open(dto: OpenYearEndDto) {
    if (dto.sourceAcademicYearId === dto.targetAcademicYearId) {
      throw new BadRequestException('Source and target academic years must differ');
    }
    const source = await this.repo.academicYear(dto.sourceAcademicYearId);
    const target = await this.repo.academicYear(dto.targetAcademicYearId);
    if (!source || !target) throw new BadRequestException('Academic year not found');
    if (!source.schoolId) {
      // Academic Year is School-scoped (Decision 1); a legacy year without a backfilled school cannot
      // be year-end processed until it is associated with its school.
      throw new BadRequestException('The source academic year is not associated with a school');
    }
    if (source.schoolId !== target.schoolId) {
      throw new BadRequestException('Both academic years must belong to the same school');
    }
    const existing = await this.repo.openProcessForSource(dto.sourceAcademicYearId);
    if (existing) return existing;

    return this.repo.createProcessWithBoard({
      schoolId: source.schoolId,
      sourceAcademicYearId: dto.sourceAcademicYearId,
      targetAcademicYearId: dto.targetAcademicYearId,
    });
  }

  /** The review board: every decision joined with the student's identity. */
  async review(processId: string) {
    const process = await this.repo.getProcess(processId);
    if (!process) throw new NotFoundException('Year-end process not found');
    const decisions = await this.repo.listDecisions(processId);
    const students = await this.repo.studentsByIds(decisions.map((d) => d.studentId));
    const byId = new Map(students.map((s) => [s.id, s]));
    return {
      process,
      decisions: decisions.map((d) => ({ ...d, student: byId.get(d.studentId) ?? null })),
    };
  }

  /** Draft a decision (preview only — no enrollment/finance is created). */
  async setDecision(decisionId: string, dto: SetDecisionDto) {
    const decision = await this.repo.getDecision(decisionId);
    if (!decision) throw new NotFoundException('Decision not found');
    const process = await this.repo.getProcess(decision.processId);
    if (process?.status !== YearEndProcessStatus.OPEN) {
      throw new BadRequestException('This year-end run is not open for edits');
    }
    if (
      (dto.action === YearEndAction.PROMOTE || dto.action === YearEndAction.REPEAT) &&
      !dto.targetGradeId
    ) {
      // Decision 10: the administrator assigns the grade — it is never auto-copied.
      throw new BadRequestException(
        'A target grade must be assigned to promote or repeat a student',
      );
    }
    return this.repo.updateDecision(decisionId, {
      action: dto.action,
      targetGradeId: dto.targetGradeId ?? null,
      targetSectionId: dto.targetSectionId ?? null,
      targetClassroomId: dto.targetClassroomId ?? null,
      ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
    });
  }

  /** Discard a draft run before commit (reversible until Final Confirm — Decision 9). */
  async cancel(processId: string) {
    const process = await this.repo.getProcess(processId);
    if (!process) throw new NotFoundException('Year-end process not found');
    if (process.status !== YearEndProcessStatus.OPEN) {
      throw new BadRequestException('Only an open year-end run can be cancelled');
    }
    return this.repo.cancelProcess(processId);
  }

  /**
   * FINAL CONFIRM. Applies every actionable decision. Resumable + idempotent per student: a decision
   * already carried out (committedAt set) is skipped, and promotion reuses a stable idempotency key so
   * re-running never double-enrols. Per-student failures are recorded on the decision and do not abort
   * the batch. DECIDE_LATER students are left untouched.
   */
  async commit(processId: string) {
    const process = await this.repo.getProcess(processId);
    if (!process) throw new NotFoundException('Year-end process not found');
    if (process.status === YearEndProcessStatus.CANCELLED) {
      throw new BadRequestException('This year-end run was cancelled');
    }

    const decisions = await this.repo.listDecisions(processId);
    let promoted = 0;
    let graduated = 0;
    let withdrawn = 0;
    let skipped = 0;
    let failed = 0;

    for (const d of decisions) {
      if (d.committedAt || d.action === YearEndAction.DECIDE_LATER) {
        skipped++;
        continue;
      }
      try {
        switch (d.action) {
          case YearEndAction.GRADUATE:
            await this.lifecycle.transition(d.sourceEnrollmentId, EnrollmentStatus.GRADUATED, {
              ...(d.reason ? { reason: d.reason } : {}),
            });
            await this.repo.updateDecision(d.id, { committedAt: new Date() });
            graduated++;
            break;
          case YearEndAction.WITHDRAW:
            await this.lifecycle.transition(d.sourceEnrollmentId, EnrollmentStatus.WITHDRAWN, {
              ...(d.reason ? { reason: d.reason } : {}),
            });
            await this.repo.updateDecision(d.id, { committedAt: new Date() });
            withdrawn++;
            break;
          case YearEndAction.PROMOTE:
          case YearEndAction.REPEAT: {
            const enrollmentId = await this.promote(processId, process.targetAcademicYearId, d);
            await this.lifecycle.transition(
              d.sourceEnrollmentId,
              d.action === YearEndAction.PROMOTE
                ? EnrollmentStatus.PROMOTED
                : EnrollmentStatus.REPEATED,
              {},
            );
            await this.repo.updateDecision(d.id, {
              committedAt: new Date(),
              resultingEnrollmentId: enrollmentId,
            });
            promoted++;
            break;
          }
          default:
            skipped++;
        }
      } catch (err) {
        failed++;
        this.logger.error(`year-end decision ${d.id} failed: ${String(err)}`);
        await this.repo.updateDecision(d.id, {
          needsReview: true,
          reviewNote: `Commit failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    // Mark the run committed even if some students were DECIDE_LATER or failed — those remain
    // actionable (a later run/fix picks them up); the run itself has been confirmed.
    await this.repo.markProcessCommitted(processId);
    return { processId, promoted, graduated, withdrawn, skipped, failed };
  }

  /**
   * Create the next-year enrollment for a promoted/repeated student through the SHARED pipeline:
   * generate a quote for the assigned grade in the target year, then add the (existing) student to
   * their Financial Account. Grade/section/classroom come from the decision — never auto-copied.
   */
  private async promote(
    processId: string,
    targetAcademicYearId: string,
    d: {
      id: string;
      studentId: string;
      targetGradeId: string | null;
      targetSectionId: string | null;
    },
  ): Promise<string> {
    if (!d.targetGradeId) throw new BadRequestException('Target grade is required to promote');
    const financialAccountId = await this.repo.studentFinancialAccountId(d.studentId);
    if (!financialAccountId) {
      throw new BadRequestException(
        'Student has no Financial Account to bill the new year through',
      );
    }

    const quote = await this.quotes.quote({
      gradeId: d.targetGradeId,
      academicYearId: targetAcademicYearId,
      studentId: d.studentId,
      paymentMode: QuotePaymentMode.INSTALLMENTS,
      installments: PROMOTION_INSTALLMENTS,
      persist: true,
    });
    if (!quote.quoteId) throw new BadRequestException('Failed to persist the promotion quote');

    const result = await this.admissions.addStudentToFamily(financialAccountId, {
      idempotencyKey: `yearend:${processId}:${d.studentId}`,
      quoteId: quote.quoteId,
      mode: AddFamilyStudentMode.NEW_PLAN,
      existingStudentId: d.studentId,
      ...(d.targetSectionId ? { sectionId: d.targetSectionId } : {}),
      confirm: true,
    });
    return result.enrollmentId;
  }
}

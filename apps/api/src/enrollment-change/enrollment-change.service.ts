import { Injectable } from '@nestjs/common';
import { EnrollmentChangeRepository } from './enrollment-change.repository';
import { AdmissionsService } from '../finance/admissions/admissions.service';
import type { CorrectGradeDto, TransferDto } from './enrollment-change.dto';

/**
 * Reason-first enrollment placement changes (PR 1 — architecture only, no ledger changes):
 *   • Administrative Transfer — different section within the same grade.
 *   • Grade Correction        — wrong grade fixed on the current enrollment (warns about fees).
 * Promotion / Repeat are NOT here — they create a NEW enrollment via Year-End Processing and must
 * never edit the current one.
 */
@Injectable()
export class EnrollmentChangeService {
  constructor(
    private readonly repo: EnrollmentChangeRepository,
    private readonly admissions: AdmissionsService,
  ) {}

  /** Fee impact of the current grade vs. what is billed — read-only; nothing changes (PR 2). */
  feeComparison(enrollmentId: string) {
    return this.admissions.feeComparison(enrollmentId);
  }

  /** Explicit recalculation — only after the admin chose "Recalculate Fees" on the comparison (PR 2). */
  recalculateFees(enrollmentId: string) {
    return this.admissions.recalculateFees(enrollmentId);
  }

  async transfer(enrollmentId: string, dto: TransferDto) {
    const enrollment = await this.repo.transfer(enrollmentId, dto);
    return { enrollmentId: enrollment.id, transferred: true };
  }

  async correctGrade(enrollmentId: string, dto: CorrectGradeDto) {
    const { enrollment, feesMayChange } = await this.repo.correctGrade(enrollmentId, dto);
    return {
      enrollmentId: enrollment.id,
      corrected: true,
      feesMayChange,
      // PR 1 does not touch the ledger — the UI shows this so the registrar reviews fees in Finance.
      feeWarning: feesMayChange
        ? 'This grade change may affect tuition. Please review fees in Finance.'
        : null,
    };
  }
}

import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { EnrollmentChangeController } from './enrollment-change.controller';
import { EnrollmentChangeService } from './enrollment-change.service';
import { EnrollmentChangeRepository } from './enrollment-change.repository';

/**
 * Enrollment placement changes: Grade Correction + Administrative Transfer (PR 1, no ledger changes),
 * plus the explicit fee comparison / recalculation (PR 2) which reuses AdmissionsService + QuoteService
 * from FinanceModule — the ledger stays the single source of truth.
 */
@Module({
  imports: [FinanceModule],
  controllers: [EnrollmentChangeController],
  providers: [EnrollmentChangeService, EnrollmentChangeRepository],
})
export class EnrollmentChangeModule {}

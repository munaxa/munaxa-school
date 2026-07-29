import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { PeopleModule } from '../people/people.module';
import { EnrollmentExitController } from './enrollment-exit.controller';
import { EnrollmentExitService } from './enrollment-exit.service';
import { EnrollmentExitRepository } from './enrollment-exit.repository';

/**
 * Enrollment exit (withdrawal + cancel admission, Decision 11). Imports FinanceModule (ChargeService
 * for ledger-safe charge cancellation) and PeopleModule (EnrollmentLifecycleService) so exits reuse
 * the one implementation — no parallel ledger or lifecycle logic.
 */
@Module({
  imports: [FinanceModule, PeopleModule],
  controllers: [EnrollmentExitController],
  providers: [EnrollmentExitService, EnrollmentExitRepository],
})
export class EnrollmentExitModule {}

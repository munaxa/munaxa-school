import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { PeopleModule } from '../people/people.module';
import { YearEndController } from './year-end.controller';
import { YearEndProcessingService } from './year-end.service';
import { YearEndRepository } from './year-end.repository';

/**
 * Year-End Processing (Decisions 9 & 10). Imports FinanceModule (shared enrollment pipeline +
 * quotation) and PeopleModule (EnrollmentLifecycleService) so promotion/repeat/graduate/withdraw reuse
 * the one implementation — no parallel enrollment writer.
 */
@Module({
  imports: [FinanceModule, PeopleModule],
  controllers: [YearEndController],
  providers: [YearEndProcessingService, YearEndRepository],
})
export class YearEndModule {}

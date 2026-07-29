import { Module } from '@nestjs/common';
import { PeopleModule } from '../people.module';
import { RecruitmentController } from './recruitment.controller';
import { RecruitmentService } from './recruitment.service';
import { RecruitmentRepository } from './recruitment.repository';

/**
 * HR Phase 8 — recruitment: job postings, applicants, interviews, and hiring. Hiring reuses
 * {@link EmployeeService} (exported from PeopleModule) to create a real Employee at status HIRED,
 * closing the loop with the Phase 1 lifecycle. Tenant-scoped and audited.
 */
@Module({
  imports: [PeopleModule],
  controllers: [RecruitmentController],
  providers: [RecruitmentService, RecruitmentRepository],
})
export class RecruitmentModule {}

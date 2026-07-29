import { Module } from '@nestjs/common';
import { EmployeeTrainingController, TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { TrainingRepository } from './training.repository';

/**
 * HR Phase 6 — training: a course catalog and per-employee training records (enrol → in-progress →
 * complete), with renewable-certification expiry tracking and an expiring-soon report. Earned
 * certificates link to the existing EmployeeDocument store. Tenant-scoped and audited.
 */
@Module({
  controllers: [TrainingController, EmployeeTrainingController],
  providers: [TrainingService, TrainingRepository],
  exports: [TrainingService], // reused by the self-service portal (Phase 9)
})
export class TrainingModule {}

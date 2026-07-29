import { Module } from '@nestjs/common';
import { EmployeePerformanceController, PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { PerformanceRepository } from './performance.repository';

/**
 * HR Phase 6 — performance management: appraisal cycles, per-employee reviews (draft → submit →
 * acknowledge) with an overall rating, and SMART goals. Every mutation is tenant-scoped and audited.
 */
@Module({
  controllers: [PerformanceController, EmployeePerformanceController],
  providers: [PerformanceService, PerformanceRepository],
  exports: [PerformanceService], // reused by the self-service portal (Phase 9)
})
export class PerformanceModule {}

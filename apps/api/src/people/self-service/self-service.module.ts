import { Module } from '@nestjs/common';
import { LeaveModule } from '../leave/leave.module';
import { StaffAttendanceModule } from '../attendance/attendance.module';
import { AssetModule } from '../assets/asset.module';
import { PerformanceModule } from '../performance/performance.module';
import { TrainingModule } from '../training/training.module';
import { EssController, TeamController } from './self-service.controller';
import { SelfServiceService } from './self-service.service';
import { SelfServiceRepository } from './self-service.repository';

/**
 * HR Phase 9 — employee self-service (`/me/hr`) and the manager portal (`/me/team`). Reuses the
 * canonical leave / attendance / asset / performance / training services (imported from their
 * modules) so no business logic is duplicated; this module only resolves the acting user to their
 * Employee and enforces report-ownership for manager actions.
 */
@Module({
  imports: [LeaveModule, StaffAttendanceModule, AssetModule, PerformanceModule, TrainingModule],
  controllers: [EssController, TeamController],
  providers: [SelfServiceService, SelfServiceRepository],
})
export class SelfServiceModule {}

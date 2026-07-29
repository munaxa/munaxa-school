import { Module } from '@nestjs/common';
import { ReportingModule } from '../../reporting/reporting.module';
import { HrDashboardController } from './hr-dashboard.controller';
import { HrDashboardService } from './hr-dashboard.service';
import { HrDashboardRepository } from './hr-dashboard.repository';

/**
 * HR Phase 10 — HR analytics dashboard, alerts feed & reporting. Read-only aggregations over the
 * HR domains (headcount, leave, recruitment, assets, performance, expiring documents/contracts/
 * certifications/probation). The alerts feed is the automation source of truth (a scheduled job
 * consumes the same query to dispatch reminders) and the structured payload is the AI-ready data
 * surface. Reuses the shared {@link ExportService} (via ReportingModule) for roster exports.
 */
@Module({
  imports: [ReportingModule],
  controllers: [HrDashboardController],
  providers: [HrDashboardService, HrDashboardRepository],
})
export class HrDashboardModule {}

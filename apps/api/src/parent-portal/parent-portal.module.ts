import { Module } from '@nestjs/common';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { StorageService } from '../common/storage.service';
import { ParentScopeService } from './common/parent-scope.service';
import { LeaveRequestController } from './leave-requests/leave-request.controller';
import { LeaveRequestService } from './leave-requests/leave-request.service';
import { LeaveRequestRepository } from './leave-requests/leave-request.repository';
import { PtmController } from './ptm/ptm.controller';
import { PtmService } from './ptm/ptm.service';
import { PtmRepository } from './ptm/ptm.repository';
import { DocumentController } from './documents/document.controller';
import { DocumentService } from './documents/document.service';
import { DocumentRepository } from './documents/document.repository';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { DashboardRepository } from './dashboard/dashboard.repository';

/**
 * Parent Portal (Phase 11): multi-child switcher + dashboard, leave/absence requests,
 * PTM slot booking, and the document vault — all row-scoped so a parent only ever sees
 * their own linked children (ParentStudent), while staff act tenant-wide.
 */
@Module({
  imports: [SchedulingModule],
  controllers: [LeaveRequestController, PtmController, DocumentController, DashboardController],
  providers: [
    ParentScopeService,
    StorageService,
    LeaveRequestService,
    LeaveRequestRepository,
    PtmService,
    PtmRepository,
    DocumentService,
    DocumentRepository,
    DashboardService,
    DashboardRepository,
  ],
})
export class ParentPortalModule {}

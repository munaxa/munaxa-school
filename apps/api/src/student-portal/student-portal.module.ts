import { Module } from '@nestjs/common';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { StorageService } from '../common/storage.service';
import { StudentScopeService } from './common/student-scope.service';
import { MeController } from './me/me.controller';
import { MeService } from './me/me.service';
import { MeRepository } from './me/me.repository';
import { ResourceController } from './resources/resource.controller';
import { ResourceService } from './resources/resource.service';
import { ResourceRepository } from './resources/resource.repository';
import { AchievementController } from './gamification/achievement.controller';
import { GamificationService } from './gamification/gamification.service';
import { GamificationRepository } from './gamification/gamification.repository';

/**
 * Student App (Phase 12): the self-scoped student surface (`/me/*` — dashboard, homework,
 * attendance, timetable, resource library, achievements, gamification), plus staff-facing
 * resource library and achievement/badge management. A Student principal only ever sees their
 * own record (`Student.userId`).
 */
@Module({
  imports: [SchedulingModule],
  controllers: [MeController, ResourceController, AchievementController],
  providers: [
    StudentScopeService,
    StorageService,
    MeService,
    MeRepository,
    ResourceService,
    ResourceRepository,
    GamificationService,
    GamificationRepository,
  ],
})
export class StudentPortalModule {}

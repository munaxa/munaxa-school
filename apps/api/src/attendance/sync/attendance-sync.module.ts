import { Module } from '@nestjs/common';
import { TeacherAttendanceRepository } from '../teachers/teacher-attendance.repository';
import { TeacherAttendanceSyncService } from './teacher-attendance-sync.service';
import { DriverAttendanceSyncService } from './driver-attendance-sync.service';
import { TeacherLinkRepository } from './teacher-link.repository';
import { DriverLinkRepository } from './driver-link.repository';

/**
 * Cross-context attendance synchronisation (PR-5 / PR-7).
 *
 * Hosts the subscribers that translate HR staff-attendance facts into Academic teacher attendance
 * and Transport driver-duty signals. Both consume the global {@link DomainEvents} bus, so this
 * module imports neither HR nor Transport — the only coupling is the event contract.
 */
@Module({
  providers: [
    TeacherAttendanceSyncService,
    DriverAttendanceSyncService,
    TeacherLinkRepository,
    DriverLinkRepository,
    TeacherAttendanceRepository,
  ],
  exports: [TeacherAttendanceSyncService, DriverAttendanceSyncService],
})
export class AttendanceSyncModule {}

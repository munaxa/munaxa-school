import { Module } from '@nestjs/common';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { StudentAttendanceController } from './students/student-attendance.controller';
import { StudentAttendanceService } from './students/student-attendance.service';
import { StudentAttendanceRepository } from './students/student-attendance.repository';
import { TeacherAttendanceController } from './teachers/teacher-attendance.controller';
import { TeacherAttendanceService } from './teachers/teacher-attendance.service';
import { TeacherAttendanceRepository } from './teachers/teacher-attendance.repository';
import { AttendanceSyncModule } from './sync/attendance-sync.module';
import { TeacherAvailabilityController } from './availability/teacher-availability.controller';
import { TeacherAvailabilityService } from './availability/teacher-availability.service';
import { TeacherAvailabilityRepository } from './availability/teacher-availability.repository';

/**
 * Attendance: idempotent student marking (manual + QR, the offline-sync target), teacher
 * attendance, the section dashboard summary, and student history (parent/student view).
 */
@Module({
  imports: [SchedulingModule, AttendanceSyncModule],
  controllers: [
    StudentAttendanceController,
    TeacherAttendanceController,
    TeacherAvailabilityController,
  ],
  providers: [
    StudentAttendanceService,
    StudentAttendanceRepository,
    TeacherAttendanceService,
    TeacherAttendanceRepository,
    TeacherAvailabilityService,
    TeacherAvailabilityRepository,
  ],
  exports: [TeacherAvailabilityService],
})
export class AttendanceModule {}

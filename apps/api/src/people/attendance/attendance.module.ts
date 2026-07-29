import { Module } from '@nestjs/common';
import { ReportingModule } from '../../reporting/reporting.module';
import { SchedulingModule } from '../../scheduling/scheduling.module';
import { AttendanceController, EmployeeAttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from './attendance.repository';
import { AttendanceLockController } from './lock/attendance-lock.controller';
import { AttendanceLockService } from './lock/attendance-lock.service';
import { AttendanceLockRepository } from './lock/attendance-lock.repository';
import { AttendanceCorrectionController } from './correction/attendance-correction.controller';
import { AttendanceCorrectionService } from './correction/attendance-correction.service';
import { AttendanceCorrectionRepository } from './correction/attendance-correction.repository';
import { AttendancePolicyController } from './policy/attendance-policy.controller';
import { AttendancePolicyService } from './policy/attendance-policy.service';
import { AttendancePolicyRepository } from './policy/attendance-policy.repository';
import { EmployeeShiftController, ShiftController } from './shift/shift.controller';
import { ShiftService } from './shift/shift.service';
import { ShiftRepository } from './shift/shift.repository';
import { BiometricController } from './biometric/biometric.controller';
import { BiometricIngestionService } from './biometric/biometric-ingestion.service';
import { BiometricRepository } from './biometric/biometric.repository';
import { BiometricProviderRegistry } from './biometric/biometric-provider.registry';
import { AttendanceAnalyticsController } from './analytics/attendance-analytics.controller';
import { AttendanceAnalyticsService } from './analytics/attendance-analytics.service';
import { AttendanceAnalyticsRepository } from './analytics/attendance-analytics.repository';

/**
 * HR Phase 5 — staff (payroll) attendance & payroll preparation. Per-employee daily attendance
 * (check-in/out, overtime, corrections) feeding a payroll-prep summary that aggregates attendance
 * with approved leave. Distinct from academic TeacherAttendance and student StudentAttendance.
 * Reuses the shared {@link ExportService} (via ReportingModule) for csv/xlsx/pdf downloads.
 *
 * The Attendance evolution program adds, all inside this same bounded context (Rule 1 — staff
 * attendance never leaves HR): configurable policy (N2), shift windows (N1), immutability locks
 * (N3), the correction workflow (N4), biometric ingestion (N5) and analytics (which extends the
 * existing reporting pipeline rather than introducing a new abstraction).
 */
@Module({
  imports: [ReportingModule, SchedulingModule],
  controllers: [
    AttendanceController,
    EmployeeAttendanceController,
    AttendanceLockController,
    AttendanceCorrectionController,
    AttendancePolicyController,
    ShiftController,
    EmployeeShiftController,
    BiometricController,
    AttendanceAnalyticsController,
  ],
  providers: [
    AttendanceService,
    AttendanceRepository,
    AttendanceLockService,
    AttendanceLockRepository,
    AttendanceCorrectionService,
    AttendanceCorrectionRepository,
    AttendancePolicyService,
    AttendancePolicyRepository,
    ShiftService,
    ShiftRepository,
    BiometricIngestionService,
    BiometricRepository,
    BiometricProviderRegistry,
    AttendanceAnalyticsService,
    AttendanceAnalyticsRepository,
  ],
  // AttendanceService is reused by the self-service portal (Phase 9); the lock/policy/shift services
  // are consumed by payroll validation and the biometric ingestion path.
  exports: [AttendanceService, AttendanceLockService, AttendancePolicyService, ShiftService],
})
export class StaffAttendanceModule {}

import { Module } from '@nestjs/common';
import { EmployeeLeaveController, LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { LeaveRepository } from './leave.repository';

/**
 * HR Phase 4 — staff leave management: leave types, per-employee balances, and requests with a
 * multi-level approval chain. Distinct from the student LeaveRequest module in the parent portal.
 */
@Module({
  controllers: [LeaveController, EmployeeLeaveController],
  providers: [LeaveService, LeaveRepository],
  exports: [LeaveService], // reused by the self-service / manager portals (Phase 9)
})
export class LeaveModule {}

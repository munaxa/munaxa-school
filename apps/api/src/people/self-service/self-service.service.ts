import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantContextStore } from '../../prisma/tenant-context';
import { LeaveService } from '../leave/leave.service';
import { AttendanceService } from '../attendance/attendance.service';
import { AssetService } from '../assets/asset.service';
import { PerformanceService } from '../performance/performance.service';
import { TrainingService } from '../training/training.service';
import { SelfServiceRepository } from './self-service.repository';
import type { CreateLeaveRequestDto, DecideLeaveRequestDto } from '../leave/leave.dto';
import type { ListAttendanceQueryDto } from '../attendance/attendance.dto';

/**
 * Employee self-service (own HR data) and the manager portal (direct reports). Resolves the acting
 * user to their Employee record and delegates to the canonical domain services — no business logic
 * (leave math, audit, balance deduction) is duplicated here; this layer only adds actor→employee
 * resolution and report-ownership authorisation.
 */
@Injectable()
export class SelfServiceService {
  constructor(
    private readonly repo: SelfServiceRepository,
    private readonly leave: LeaveService,
    private readonly attendance: AttendanceService,
    private readonly assets: AssetService,
    private readonly performance: PerformanceService,
    private readonly training: TrainingService,
  ) {}

  // ----- Employee self-service ----------------------------------------------
  async myProfile() {
    const employeeId = await this.myEmployeeId();
    const profile = await this.repo.myProfile(employeeId);
    if (!profile) throw new NotFoundException('Employee profile not found');
    return profile;
  }
  async myLeaveBalances() {
    return this.leave.listBalances(await this.myEmployeeId());
  }
  async myLeaveRequests() {
    return this.leave.listForEmployee(await this.myEmployeeId());
  }
  async submitLeave(dto: CreateLeaveRequestDto) {
    return this.leave.createRequest(await this.myEmployeeId(), dto);
  }
  async cancelLeave(requestId: string) {
    await this.assertOwnLeave(requestId);
    return this.leave.cancel(requestId);
  }
  async myAttendance(query: ListAttendanceQueryDto) {
    return this.attendance.listForEmployee(await this.myEmployeeId(), query);
  }
  async myAssets() {
    return this.assets.listForEmployee(await this.myEmployeeId());
  }
  async myTraining() {
    return this.training.listForEmployee(await this.myEmployeeId());
  }
  async myReviews() {
    return this.performance.listReviews(await this.myEmployeeId());
  }
  async acknowledgeReview(reviewId: string) {
    const employeeId = await this.myEmployeeId();
    const review = await this.performance.getReview(reviewId);
    if (review.employeeId !== employeeId) {
      throw new ForbiddenException('This review does not belong to you');
    }
    return this.performance.acknowledgeReview(reviewId);
  }

  // ----- Manager portal -----------------------------------------------------
  async myReports() {
    return this.repo.reports(await this.myEmployeeId());
  }
  async teamPendingLeave() {
    return this.repo.teamPendingLeave(await this.myEmployeeId());
  }
  async approveTeamLeave(requestId: string, dto: DecideLeaveRequestDto) {
    await this.assertTeamLeave(requestId);
    return this.leave.approve(requestId, dto);
  }
  async rejectTeamLeave(requestId: string, dto: DecideLeaveRequestDto) {
    await this.assertTeamLeave(requestId);
    return this.leave.reject(requestId, dto);
  }

  // ----- Helpers ------------------------------------------------------------
  /** Resolve the acting user to their Employee id, or 401/403 if there is none. */
  private async myEmployeeId(): Promise<string> {
    const userId = TenantContextStore.get()?.actorUserId;
    if (!userId) throw new UnauthorizedException('No acting user');
    const employeeId = await this.repo.employeeIdForUser(userId);
    if (!employeeId)
      throw new ForbiddenException('Your account is not linked to an employee record');
    return employeeId;
  }
  private async assertOwnLeave(requestId: string) {
    const [me, owner] = await Promise.all([
      this.myEmployeeId(),
      this.repo.leaveRequestOwner(requestId),
    ]);
    if (!owner) throw new NotFoundException('Leave request not found');
    if (owner !== me) throw new ForbiddenException('This leave request does not belong to you');
  }
  private async assertTeamLeave(requestId: string) {
    const me = await this.myEmployeeId();
    const owner = await this.repo.leaveRequestOwner(requestId);
    if (!owner) throw new NotFoundException('Leave request not found');
    if (!(await this.repo.isReport(me, owner))) {
      throw new ForbiddenException('This request is not from one of your direct reports');
    }
  }
}

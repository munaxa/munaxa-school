import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveApprovalDecision, StaffLeaveStatus, type Prisma } from '@prisma/client';
import { LeaveRepository, type LeaveRequestView } from './leave.repository';
import { workingDaysBetween } from './leave-days.logic';
import type {
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  DecideLeaveRequestDto,
  ListLeaveRequestsQueryDto,
  SetLeaveBalanceDto,
  UpdateLeaveTypeDto,
} from './leave.dto';

@Injectable()
export class LeaveService {
  constructor(private readonly repo: LeaveRepository) {}

  // ----- Leave types --------------------------------------------------------
  createType(dto: CreateLeaveTypeDto) {
    return this.repo.createType({
      name: dto.name,
      ...(dto.code !== undefined ? { code: dto.code } : {}),
      ...(dto.paid !== undefined ? { paid: dto.paid } : {}),
      ...(dto.defaultAnnualDays !== undefined ? { defaultAnnualDays: dto.defaultAnnualDays } : {}),
      ...(dto.approvalLevels !== undefined ? { approvalLevels: dto.approvalLevels } : {}),
      ...(dto.colorHex !== undefined ? { colorHex: dto.colorHex } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
  }
  listTypes() {
    return this.repo.listTypes();
  }
  async updateType(id: string, dto: UpdateLeaveTypeDto) {
    await this.getType(id);
    const data: Prisma.StaffLeaveTypeUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.paid !== undefined) data.paid = dto.paid;
    if (dto.defaultAnnualDays !== undefined) data.defaultAnnualDays = dto.defaultAnnualDays;
    if (dto.approvalLevels !== undefined) data.approvalLevels = dto.approvalLevels;
    if (dto.colorHex !== undefined) data.colorHex = dto.colorHex;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.repo.updateType(id, data);
  }
  async removeType(id: string) {
    await this.getType(id);
    await this.repo.softDeleteType(id);
  }
  private async getType(id: string) {
    const type = await this.repo.findType(id);
    if (!type) throw new NotFoundException('Leave type not found');
    return type;
  }

  // ----- Balances -----------------------------------------------------------
  async listBalances(employeeId: string) {
    await this.assertEmployee(employeeId);
    return this.repo.listBalances(employeeId);
  }
  async setBalance(employeeId: string, dto: SetLeaveBalanceDto) {
    await this.assertEmployee(employeeId);
    await this.getType(dto.leaveTypeId);
    return this.repo.setBalance(employeeId, dto.leaveTypeId, dto.year, dto.entitledDays);
  }

  // ----- Requests -----------------------------------------------------------
  async createRequest(employeeId: string, dto: CreateLeaveRequestDto): Promise<LeaveRequestView> {
    await this.assertEmployee(employeeId);
    const type = await this.getType(dto.leaveTypeId);
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) throw new BadRequestException('endDate must be on or after startDate');
    const workingDays = workingDaysBetween(start, end);
    if (workingDays <= 0) {
      throw new BadRequestException('The requested range contains no working days');
    }
    return this.repo.createRequest({
      employeeId,
      leaveTypeId: dto.leaveTypeId,
      startDate: start,
      endDate: end,
      workingDays,
      reason: dto.reason ?? null,
      requiredLevels: type.approvalLevels,
      currentLevel: 1,
      status: StaffLeaveStatus.PENDING,
    });
  }

  listRequests(query: ListLeaveRequestsQueryDto): Promise<LeaveRequestView[]> {
    return this.repo.listRequests({
      status: query.status,
      employeeId: query.employeeId,
      take: query.take ?? 200,
    });
  }

  async listForEmployee(employeeId: string): Promise<LeaveRequestView[]> {
    await this.assertEmployee(employeeId);
    return this.repo.listRequests({ employeeId, take: 200 });
  }

  async approve(id: string, dto: DecideLeaveRequestDto): Promise<LeaveRequestView> {
    return this.decide(id, LeaveApprovalDecision.APPROVED, dto.note);
  }
  async reject(id: string, dto: DecideLeaveRequestDto): Promise<LeaveRequestView> {
    return this.decide(id, LeaveApprovalDecision.REJECTED, dto.note);
  }

  private async decide(
    id: string,
    decision: LeaveApprovalDecision,
    note: string | undefined,
  ): Promise<LeaveRequestView> {
    const request = await this.getRequest(id);
    if (request.status !== StaffLeaveStatus.PENDING) {
      throw new BadRequestException(
        `This request is ${request.status.toLowerCase()} and cannot be decided`,
      );
    }
    const year = request.startDate.getUTCFullYear();
    const days = Number(request.workingDays);

    if (decision === LeaveApprovalDecision.REJECTED) {
      return this.repo.decide({
        requestId: id,
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        year,
        level: request.currentLevel,
        decision,
        note,
        newStatus: StaffLeaveStatus.REJECTED,
        newLevel: request.currentLevel,
        balanceDelta: 0,
      });
    }

    // Approval: advance a level, or finalise + deduct balance on the last level.
    const isFinal = request.currentLevel >= request.requiredLevels;
    return this.repo.decide({
      requestId: id,
      employeeId: request.employeeId,
      leaveTypeId: request.leaveTypeId,
      year,
      level: request.currentLevel,
      decision,
      note,
      newStatus: isFinal ? StaffLeaveStatus.APPROVED : StaffLeaveStatus.PENDING,
      newLevel: isFinal ? request.currentLevel : request.currentLevel + 1,
      balanceDelta: isFinal ? days : 0,
    });
  }

  async cancel(id: string): Promise<LeaveRequestView> {
    const request = await this.getRequest(id);
    if (
      request.status === StaffLeaveStatus.CANCELLED ||
      request.status === StaffLeaveStatus.REJECTED
    ) {
      throw new BadRequestException('This request cannot be cancelled');
    }
    const restore =
      request.status === StaffLeaveStatus.APPROVED
        ? {
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year: request.startDate.getUTCFullYear(),
            days: Number(request.workingDays),
          }
        : null;
    return this.repo.cancel({ requestId: id, restore });
  }

  private async getRequest(id: string): Promise<LeaveRequestView> {
    const request = await this.repo.findRequest(id);
    if (!request) throw new NotFoundException('Leave request not found');
    return request;
  }

  private async assertEmployee(employeeId: string) {
    if (!(await this.repo.employeeExists(employeeId))) {
      throw new NotFoundException('Employee not found');
    }
  }
}

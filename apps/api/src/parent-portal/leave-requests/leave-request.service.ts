import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { LeaveRequest, LeaveRequestStatus } from '@prisma/client';
import { Permission } from '@school/domain';
import { TenantContextStore } from '../../prisma/tenant-context';
import { ParentScopeService } from '../common/parent-scope.service';
import { LeaveRequestRepository } from './leave-request.repository';
import type { CreateLeaveRequestDto, DecideLeaveRequestDto } from './leave-request.dto';

@Injectable()
export class LeaveRequestService {
  constructor(
    private readonly repo: LeaveRequestRepository,
    private readonly scope: ParentScopeService,
  ) {}

  async create(dto: CreateLeaveRequestDto): Promise<LeaveRequest> {
    await this.scope.assertChildAccess(dto.studentId);
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
    return this.repo.create({
      studentId: dto.studentId,
      type: dto.type,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      reason: dto.reason,
      requestedById: TenantContextStore.get()?.actorUserId ?? null,
    });
  }

  /**
   * Staff with leave:approve see the whole tenant queue; parents see only their children's.
   */
  async list(status?: LeaveRequestStatus): Promise<LeaveRequest[]> {
    if (this.scope.hasPermission(Permission.LEAVE_APPROVE)) {
      return this.repo.findAll(status);
    }
    const childIds = await this.scope.childIds();
    if (childIds.length === 0) return [];
    return this.repo.findForStudents(childIds, status);
  }

  async decide(id: string, dto: DecideLeaveRequestDto): Promise<LeaveRequest> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Leave request not found');
    if (existing.status !== 'PENDING') {
      throw new BadRequestException(`Cannot decide a ${existing.status} request`);
    }
    return this.repo.decide(
      id,
      dto.decision,
      TenantContextStore.get()?.actorUserId ?? null,
      dto.reviewNote ?? null,
    );
  }

  async cancel(id: string): Promise<LeaveRequest> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Leave request not found');
    // A parent may only cancel their own child's pending request.
    if (!this.scope.hasPermission(Permission.LEAVE_APPROVE)) {
      await this.scope.assertChildAccess(existing.studentId);
    }
    if (existing.status !== 'PENDING') {
      throw new BadRequestException(`Cannot cancel a ${existing.status} request`);
    }
    return this.repo.cancel(id);
  }
}

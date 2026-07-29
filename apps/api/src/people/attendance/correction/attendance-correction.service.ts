import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AttendanceCorrectionRepository,
  type CorrectionView,
} from './attendance-correction.repository';
import { AttendanceService } from '../attendance.service';
import {
  approve,
  canCancel,
  canDecide,
  normaliseRequiredLevels,
  reject,
} from './attendance-correction.logic';
import type {
  CreateCorrectionRequestDto,
  DecideCorrectionDto,
  ListCorrectionsQueryDto,
} from './attendance-correction.dto';

/**
 * Attendance correction workflow (N4).
 *
 * Enterprise flow: an employee (or their manager) raises a request with a mandatory reason and
 * optional evidence; approvers decide level by level; the final approval **applies** the change
 * through the canonical attendance write path and marks the request APPLIED.
 *
 * Nothing is edited in place by the requester, every decision is recorded in an immutable approval
 * trail, and the original status is preserved on the request itself — so history is never
 * overwritten. Transition rules live in the pure logic module (Rule 5).
 */
@Injectable()
export class AttendanceCorrectionService {
  constructor(
    private readonly repo: AttendanceCorrectionRepository,
    private readonly attendance: AttendanceService,
  ) {}

  async create(dto: CreateCorrectionRequestDto): Promise<CorrectionView> {
    if (!(await this.repo.employeeExists(dto.employeeId))) {
      throw new NotFoundException('Employee not found');
    }
    const date = parseDate(dto.date);
    // Snapshot what is recorded today so the request carries an immutable "corrected from" value.
    const previousStatus = await this.repo.currentStatusFor(dto.employeeId, date);

    return this.repo.create({
      employeeId: dto.employeeId,
      date,
      requestedStatus: dto.requestedStatus,
      requestedCheckInAt: dto.requestedCheckInAt ? new Date(dto.requestedCheckInAt) : null,
      requestedCheckOutAt: dto.requestedCheckOutAt ? new Date(dto.requestedCheckOutAt) : null,
      requestedNote: dto.requestedNote ?? null,
      previousStatus,
      reason: dto.reason,
      evidenceUrl: dto.evidenceUrl ?? null,
      requiredLevels: normaliseRequiredLevels(dto.requiredLevels),
    });
  }

  list(query: ListCorrectionsQueryDto): Promise<CorrectionView[]> {
    return this.repo.list({
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.employeeId !== undefined ? { employeeId: query.employeeId } : {}),
    });
  }

  async get(id: string): Promise<CorrectionView> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException('Correction request not found');
    return row;
  }

  /** Approve the current level; the final level applies the correction to the attendance row. */
  async approve(id: string, dto: DecideCorrectionDto): Promise<CorrectionView> {
    const request = await this.get(id);
    if (!canDecide(request)) {
      throw new BadRequestException(
        `This request is ${request.status.toLowerCase()} and cannot be decided`,
      );
    }
    const transition = approve(request);
    const decided = await this.repo.decide({
      requestId: id,
      level: request.currentLevel,
      decision: 'APPROVED',
      note: dto.note ?? null,
      newStatus: transition.status,
      newLevel: transition.currentLevel,
    });

    if (!transition.shouldApply) return decided;

    // Final approval: land the change through the canonical write path, then seal the request.
    await this.attendance.applyApprovedCorrection(request.employeeId, request.date, {
      status: request.requestedStatus,
      checkInAt: request.requestedCheckInAt,
      checkOutAt: request.requestedCheckOutAt,
      note: request.requestedNote,
    });
    return this.repo.markApplied(id);
  }

  async reject(id: string, dto: DecideCorrectionDto): Promise<CorrectionView> {
    const request = await this.get(id);
    if (!canDecide(request)) {
      throw new BadRequestException(
        `This request is ${request.status.toLowerCase()} and cannot be decided`,
      );
    }
    const transition = reject(request);
    return this.repo.decide({
      requestId: id,
      level: request.currentLevel,
      decision: 'REJECTED',
      note: dto.note ?? null,
      newStatus: transition.status,
      newLevel: transition.currentLevel,
    });
  }

  async cancel(id: string): Promise<CorrectionView> {
    const request = await this.get(id);
    if (!canCancel(request)) {
      throw new BadRequestException('This request can no longer be cancelled');
    }
    return this.repo.cancel(id);
  }
}

function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

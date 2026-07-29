import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceLockStatus, type AttendanceLock } from '@prisma/client';
import { AttendanceLockRepository } from './attendance-lock.repository';
import { findCoveringLock, isRangeUnlocked } from './attendance-lock.logic';
import type {
  CreateAttendanceLockDto,
  ListAttendanceLocksQueryDto,
  ReleaseAttendanceLockDto,
} from './attendance-lock.dto';

/** Thrown when a write targets a locked day. Mapped to 409 by the controller layer. */
export class AttendanceLockedError extends ConflictException {
  constructor(date: Date, lockId: string) {
    super(
      `Attendance for ${date.toISOString().slice(0, 10)} is locked (lock ${lockId}). ` +
        'Submit a correction request instead.',
    );
  }
}

/**
 * Attendance locking (N3). Owns the lock lifecycle and is the single authority consulted before any
 * staff-attendance write. Coverage rules live in the pure logic module so the guard, the correction
 * workflow and payroll validation all evaluate locks identically.
 */
@Injectable()
export class AttendanceLockService {
  constructor(private readonly repo: AttendanceLockRepository) {}

  async create(dto: CreateAttendanceLockDto): Promise<AttendanceLock> {
    const periodStart = parseDate(dto.periodStart);
    const periodEnd = parseDate(dto.periodEnd);
    if (periodEnd < periodStart) {
      throw new BadRequestException('`periodEnd` must be on or after `periodStart`');
    }
    return this.repo.create({
      scope: dto.scope,
      periodStart,
      periodEnd,
      campusId: dto.campusId ?? null,
      reason: dto.reason ?? null,
    });
  }

  async release(id: string, dto: ReleaseAttendanceLockDto): Promise<AttendanceLock> {
    const lock = await this.repo.findById(id);
    if (!lock) throw new NotFoundException('Attendance lock not found');
    if (lock.status === AttendanceLockStatus.RELEASED) {
      throw new BadRequestException('This lock has already been released');
    }
    return this.repo.release(id, dto.note ?? null);
  }

  list(query: ListAttendanceLocksQueryDto): Promise<AttendanceLock[]> {
    return this.repo.list(query.status);
  }

  /**
   * Guard for the canonical write path: throws when `date` sits inside an active lock.
   * Called by {@link AttendanceService} before recording or bulk-marking.
   */
  async assertWritable(date: Date, campusId?: string | null): Promise<void> {
    const locks = await this.repo.activeCovering(date, date);
    const covering = findCoveringLock(locks, date, campusId ?? null);
    if (covering) throw new AttendanceLockedError(date, covering.id);
  }

  /** Whether a date is currently locked (non-throwing form, for read models/UI). */
  async isLocked(date: Date, campusId?: string | null): Promise<boolean> {
    const locks = await this.repo.activeCovering(date, date);
    return findCoveringLock(locks, date, campusId ?? null) !== null;
  }

  /**
   * Whether an entire range is free of active locks. Payroll validation inverts this: a payroll
   * period *must* be locked before it can be validated, so it asks for the covering locks instead.
   */
  async isRangeWritable(from: Date, to: Date, campusId?: string | null): Promise<boolean> {
    const locks = await this.repo.activeCovering(from, to);
    return isRangeUnlocked(locks, from, to, campusId ?? null);
  }

  /** Active locks intersecting a range — used by payroll validation to prove a period is sealed. */
  activeCovering(from: Date, to: Date): Promise<AttendanceLock[]> {
    return this.repo.activeCovering(from, to);
  }
}

function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

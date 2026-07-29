import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { EmployeeShiftAssignment, Prisma } from '@prisma/client';
import { ShiftRepository, type ShiftView } from './shift.repository';
import { measureShift, type ShiftPunches, type ShiftWindow } from '../shift-window.logic';
import { timeToMinutes } from '../../../scheduling/engine/scheduling-engine';
import type { AttendanceMeasurement } from '../attendance-policy.logic';
import type { AssignShiftDto, CreateShiftDto, UpdateShiftDto } from './shift.dto';

/**
 * Shift management (N1). Owns shift definitions and employee assignments, and turns a persisted
 * shift plus a day's punches into the {@link AttendanceMeasurement} the policy engine evaluates.
 *
 * The arithmetic itself lives in the pure `shift-window.logic` module — this service only resolves
 * which shift applies and adapts the row to the pure input (Rule 4/5).
 */
@Injectable()
export class ShiftService {
  constructor(private readonly repo: ShiftRepository) {}

  async create(dto: CreateShiftDto): Promise<ShiftView> {
    assertWindowOrder(dto.expectedCheckIn, dto.expectedCheckOut);
    return this.repo.create(toCreateData(dto));
  }

  list(): Promise<ShiftView[]> {
    return this.repo.list();
  }

  async get(id: string): Promise<ShiftView> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException('Shift not found');
    return row;
  }

  async update(id: string, dto: UpdateShiftDto): Promise<ShiftView> {
    const current = await this.get(id);
    const checkIn = dto.expectedCheckIn ?? current.expectedCheckIn;
    const checkOut = dto.expectedCheckOut ?? current.expectedCheckOut;
    assertWindowOrder(checkIn, checkOut);

    const data: Prisma.ShiftUncheckedUpdateInput = {};
    for (const key of [
      'name',
      'kind',
      'expectedCheckIn',
      'expectedCheckOut',
      'breakMinutes',
      'maxHours',
      'campusId',
      'policyId',
      'isActive',
    ] as const) {
      const value = dto[key];
      if (value !== undefined) (data as Record<string, unknown>)[key] = value;
    }
    return this.repo.update(id, data);
  }

  async assign(employeeId: string, dto: AssignShiftDto): Promise<EmployeeShiftAssignment> {
    if (!(await this.repo.employeeExists(employeeId))) {
      throw new NotFoundException('Employee not found');
    }
    await this.get(dto.shiftId);
    const effectiveFrom = parseDate(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? parseDate(dto.effectiveTo) : null;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException('`effectiveTo` must be on or after `effectiveFrom`');
    }
    return this.repo.assign({
      employeeId,
      shiftId: dto.shiftId,
      effectiveFrom,
      effectiveTo,
      ...(dto.daysOfWeek !== undefined ? { daysOfWeek: dto.daysOfWeek } : {}),
    });
  }

  listAssignments(employeeId: string): Promise<EmployeeShiftAssignment[]> {
    return this.repo.listAssignments(employeeId);
  }

  /** The shift in force for an employee on a date, or null when none is assigned. */
  shiftFor(employeeId: string, date: Date): Promise<ShiftView | null> {
    return this.repo.shiftForEmployeeOn(employeeId, date);
  }

  /**
   * Measure a day against the employee's assigned shift. Returns null when no shift applies, which
   * tells callers to keep whatever the client supplied (no silent derivation, no behaviour change
   * for tenants that have not adopted shifts).
   */
  async measure(
    employeeId: string,
    date: Date,
    punches: ShiftPunches,
  ): Promise<AttendanceMeasurement | null> {
    const shift = await this.shiftFor(employeeId, date);
    if (!shift) return null;
    return measureShift(toWindow(shift), punches);
  }
}

/** Adapt a persisted shift row to the pure engine's window input. */
export function toWindow(shift: ShiftView): ShiftWindow {
  return {
    expectedCheckIn: shift.expectedCheckIn,
    expectedCheckOut: shift.expectedCheckOut,
    breakMinutes: shift.breakMinutes,
    maxHours: shift.maxHours === null ? null : Number(shift.maxHours),
  };
}

function assertWindowOrder(checkIn: string, checkOut: string): void {
  // Same-day shifts only for now (documented limitation in shift-window.logic).
  if (timeToMinutes(checkOut) <= timeToMinutes(checkIn)) {
    throw new BadRequestException('expectedCheckOut must be later than expectedCheckIn');
  }
}

function toCreateData(dto: CreateShiftDto): Prisma.ShiftUncheckedCreateWithoutTenantInput {
  return {
    name: dto.name,
    expectedCheckIn: dto.expectedCheckIn,
    expectedCheckOut: dto.expectedCheckOut,
    ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
    ...(dto.breakMinutes !== undefined ? { breakMinutes: dto.breakMinutes } : {}),
    ...(dto.maxHours !== undefined ? { maxHours: dto.maxHours } : {}),
    ...(dto.campusId !== undefined ? { campusId: dto.campusId } : {}),
    ...(dto.policyId !== undefined ? { policyId: dto.policyId } : {}),
    ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
  };
}

function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

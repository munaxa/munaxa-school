import { Injectable, NotFoundException } from '@nestjs/common';
import type { AttendancePolicy, Prisma } from '@prisma/client';
import { AttendancePolicyRepository } from './attendance-policy.repository';
import { DEFAULT_ATTENDANCE_POLICY, type AttendancePolicyConfig } from '../attendance-policy.logic';
import type { CreateAttendancePolicyDto, UpdateAttendancePolicyDto } from './attendance-policy.dto';

/**
 * Attendance policy configuration (N2).
 *
 * Persists tenant/campus thresholds and resolves the {@link AttendancePolicyConfig} consumed by the
 * pure evaluation engine. When nothing is configured it returns the built-in default, so behaviour
 * is unchanged for tenants that never touch policy (backward compatible by construction).
 */
@Injectable()
export class AttendancePolicyService {
  constructor(private readonly repo: AttendancePolicyRepository) {}

  async create(dto: CreateAttendancePolicyDto): Promise<AttendancePolicy> {
    const row = await this.repo.create(toCreateData(dto));
    if (dto.isDefault) await this.repo.clearOtherDefaults(row.id);
    return row;
  }

  list(): Promise<AttendancePolicy[]> {
    return this.repo.list();
  }

  async get(id: string): Promise<AttendancePolicy> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException('Attendance policy not found');
    return row;
  }

  async update(id: string, dto: UpdateAttendancePolicyDto): Promise<AttendancePolicy> {
    await this.get(id);
    const data: Prisma.AttendancePolicyUncheckedUpdateInput = {};
    for (const key of [
      'name',
      'campusId',
      'isDefault',
      'graceMinutes',
      'lateAfterMinutes',
      'absentAfterMinutes',
      'halfDayAfterShortfallMinutes',
      'earlyDepartureAfterMinutes',
      'overtimeAfterMinutes',
      'countWeekendAsWorking',
      'allowManualOverride',
      'isActive',
    ] as const) {
      const value = dto[key];
      if (value !== undefined) {
        (data as Record<string, unknown>)[key] = value;
      }
    }
    const row = await this.repo.update(id, data);
    if (dto.isDefault) await this.repo.clearOtherDefaults(row.id);
    return row;
  }

  /**
   * The effective policy config for a campus. Falls back to {@link DEFAULT_ATTENDANCE_POLICY} when
   * no row is configured — the single place that fallback is decided.
   */
  async resolveConfig(campusId?: string | null): Promise<AttendancePolicyConfig> {
    const row = await this.repo.resolveFor(campusId ?? null);
    return row ? toConfig(row) : DEFAULT_ATTENDANCE_POLICY;
  }
}

/** Map a persisted policy row onto the pure engine's config shape. */
export function toConfig(row: AttendancePolicy): AttendancePolicyConfig {
  return {
    graceMinutes: row.graceMinutes,
    lateAfterMinutes: row.lateAfterMinutes,
    absentAfterMinutes: row.absentAfterMinutes,
    halfDayAfterShortfallMinutes: row.halfDayAfterShortfallMinutes,
    earlyDepartureAfterMinutes: row.earlyDepartureAfterMinutes,
    overtimeAfterMinutes: row.overtimeAfterMinutes,
    countWeekendAsWorking: row.countWeekendAsWorking,
    allowManualOverride: row.allowManualOverride,
  };
}

function toCreateData(
  dto: CreateAttendancePolicyDto,
): Prisma.AttendancePolicyUncheckedCreateWithoutTenantInput {
  return {
    name: dto.name,
    ...(dto.campusId !== undefined ? { campusId: dto.campusId } : {}),
    ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
    ...(dto.graceMinutes !== undefined ? { graceMinutes: dto.graceMinutes } : {}),
    ...(dto.lateAfterMinutes !== undefined ? { lateAfterMinutes: dto.lateAfterMinutes } : {}),
    ...(dto.absentAfterMinutes !== undefined ? { absentAfterMinutes: dto.absentAfterMinutes } : {}),
    ...(dto.halfDayAfterShortfallMinutes !== undefined
      ? { halfDayAfterShortfallMinutes: dto.halfDayAfterShortfallMinutes }
      : {}),
    ...(dto.earlyDepartureAfterMinutes !== undefined
      ? { earlyDepartureAfterMinutes: dto.earlyDepartureAfterMinutes }
      : {}),
    ...(dto.overtimeAfterMinutes !== undefined
      ? { overtimeAfterMinutes: dto.overtimeAfterMinutes }
      : {}),
    ...(dto.countWeekendAsWorking !== undefined
      ? { countWeekendAsWorking: dto.countWeekendAsWorking }
      : {}),
    ...(dto.allowManualOverride !== undefined
      ? { allowManualOverride: dto.allowManualOverride }
      : {}),
    ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
  };
}

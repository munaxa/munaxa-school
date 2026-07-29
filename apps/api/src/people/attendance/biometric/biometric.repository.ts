import { Injectable } from '@nestjs/common';
import type { BiometricRawPunch, Prisma } from '@prisma/client';
import { TenantRepository } from '../../../common/tenant.repository';
import type { NormalisedPunch } from './biometric-provider.port';

/** A day's worth of punches for one employee, reduced to first-in / last-out. */
export interface DayPunchWindow {
  employeeId: string;
  date: Date;
  checkInAt: Date | null;
  checkOutAt: Date | null;
}

/** Persistence-only access to raw device punches. */
@Injectable()
export class BiometricRepository extends TenantRepository {
  /**
   * Store a batch of punches idempotently. The unique key (tenant, provider, externalRef) means a
   * redelivered device batch is a no-op rather than a duplicate — safe for retries at any level.
   * Returns how many rows were newly stored.
   */
  storeBatch(providerKey: string, punches: NormalisedPunch[]): Promise<number> {
    return this.run(async (tx, tenantId) => {
      if (punches.length === 0) return 0;
      const result = await tx.biometricRawPunch.createMany({
        data: punches.map((p) => ({
          tenantId,
          providerKey,
          externalRef: p.externalRef,
          externalUserRef: p.externalUserRef,
          employeeId: p.employeeId ?? null,
          punchAt: p.punchAt,
          direction: p.direction,
          deviceId: p.deviceId ?? null,
          ...(p.raw ? { rawPayload: p.raw as Prisma.InputJsonValue } : {}),
        })),
        skipDuplicates: true,
      });
      return result.count;
    });
  }

  /** Resolve device-reported user references to employee ids via the employee number. */
  resolveEmployeesByNumber(refs: string[]): Promise<Map<string, string>> {
    return this.run(async (tx) => {
      if (refs.length === 0) return new Map<string, string>();
      const employees = await tx.employee.findMany({
        where: { employeeNumber: { in: refs }, deletedAt: null },
        select: { id: true, employeeNumber: true },
      });
      return new Map(
        employees
          .filter((e): e is { id: string; employeeNumber: string } => e.employeeNumber !== null)
          .map((e) => [e.employeeNumber, e.id]),
      );
    });
  }

  /** Attach resolved employee ids to stored punches that arrived unresolved. */
  attachEmployee(providerKey: string, externalRefs: string[], employeeId: string): Promise<number> {
    return this.run(async (tx) => {
      if (externalRefs.length === 0) return 0;
      const result = await tx.biometricRawPunch.updateMany({
        where: { providerKey, externalRef: { in: externalRefs }, employeeId: null },
        data: { employeeId },
      });
      return result.count;
    });
  }

  /** Unprocessed punches for a date, grouped into a first-in / last-out window per employee. */
  pendingWindows(date: Date): Promise<DayPunchWindow[]> {
    const dayStart = new Date(date);
    const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);
    return this.run(async (tx) => {
      const punches = await tx.biometricRawPunch.findMany({
        where: {
          processedAt: null,
          employeeId: { not: null },
          punchAt: { gte: dayStart, lte: dayEnd },
        },
        orderBy: { punchAt: 'asc' },
        select: { employeeId: true, punchAt: true, direction: true },
      });

      const byEmployee = new Map<string, DayPunchWindow>();
      for (const punch of punches) {
        const employeeId = punch.employeeId;
        if (!employeeId) continue;
        const entry =
          byEmployee.get(employeeId) ??
          ({ employeeId, date, checkInAt: null, checkOutAt: null } satisfies DayPunchWindow);
        if (punch.direction === 'IN') {
          // First IN of the day wins.
          if (entry.checkInAt === null) entry.checkInAt = punch.punchAt;
        } else {
          // Last OUT of the day wins.
          entry.checkOutAt = punch.punchAt;
        }
        byEmployee.set(employeeId, entry);
      }
      return [...byEmployee.values()];
    });
  }

  /** Mark a date's punches processed (optionally recording a failure reason). */
  markProcessed(date: Date, employeeIds: string[], error?: string | null): Promise<number> {
    const dayStart = new Date(date);
    const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);
    return this.run(async (tx) => {
      if (employeeIds.length === 0) return 0;
      const result = await tx.biometricRawPunch.updateMany({
        where: {
          employeeId: { in: employeeIds },
          punchAt: { gte: dayStart, lte: dayEnd },
          processedAt: null,
        },
        data: { processedAt: new Date(), processingError: error ?? null },
      });
      return result.count;
    });
  }

  listRecent(take = 100): Promise<BiometricRawPunch[]> {
    return this.run((tx) => tx.biometricRawPunch.findMany({ orderBy: { punchAt: 'desc' }, take }));
  }
}

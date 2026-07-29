import { Injectable } from '@nestjs/common';
import { TenantRepository } from '../../common/tenant.repository';

export interface DriverLink {
  driverProfileId: string;
  busIds: string[];
}

/**
 * Persistence-only lookup of the Employee↔Driver↔Bus links. Reads only — driver identity lives on
 * the HR `Employee` (Phase-3 driver refactor) and buses belong to Transport; nothing is duplicated.
 */
@Injectable()
export class DriverLinkRepository extends TenantRepository {
  /** The driver profile (and buses driven) for an employee, or null when they do not drive. */
  driverForEmployee(employeeId: string): Promise<DriverLink | null> {
    return this.run(async (tx) => {
      const profile = await tx.driverProfile.findFirst({
        where: { employeeId },
        select: { id: true },
      });
      if (!profile) return null;

      const buses = await tx.bus.findMany({
        where: { driverId: employeeId },
        select: { id: true },
      });
      return { driverProfileId: profile.id, busIds: buses.map((b) => b.id) };
    });
  }
}

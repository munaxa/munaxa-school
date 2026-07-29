import { Injectable } from '@nestjs/common';
import type { TimetableConfig } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

/** Per-campus scheduling settings (Ramadan mode + window). Stored in the TimetableConfig table. */
@Injectable()
export class RamadanConfigRepository extends TenantRepository {
  findByCampus(campusId: string): Promise<TimetableConfig | null> {
    return this.run((tx) => tx.timetableConfig.findFirst({ where: { campusId } }));
  }

  upsert(
    campusId: string,
    data: {
      ramadanModeEnabled: boolean;
      ramadanStartDate: Date | null;
      ramadanEndDate: Date | null;
    },
  ): Promise<TimetableConfig> {
    return this.run(async (tx, tenantId) => {
      const existing = await tx.timetableConfig.findFirst({ where: { campusId } });
      if (existing) {
        return tx.timetableConfig.update({ where: { id: existing.id }, data });
      }
      return tx.timetableConfig.create({ data: { ...data, tenantId, campusId } });
    });
  }

  campusExists(campusId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.campus.findFirst({ where: { id: campusId, deletedAt: null } })) !== null,
    );
  }
}

import { Injectable } from '@nestjs/common';
import type { Prisma, ScheduleException } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class ScheduleExceptionRepository extends TenantRepository {
  create(
    data: Omit<Prisma.ScheduleExceptionUncheckedCreateInput, 'tenantId'>,
  ): Promise<ScheduleException> {
    return this.run((tx, tenantId) => tx.scheduleException.create({ data: { ...data, tenantId } }));
  }

  findMany(filter: { sectionId?: string; date?: Date }): Promise<ScheduleException[]> {
    return this.run((tx) =>
      tx.scheduleException.findMany({
        where: {
          ...(filter.date ? { date: filter.date } : {}),
          ...(filter.sectionId
            ? { OR: [{ sectionId: filter.sectionId }, { sectionId: null }] }
            : {}),
        },
        orderBy: [{ date: 'desc' }],
      }),
    );
  }

  findById(id: string): Promise<ScheduleException | null> {
    return this.run((tx) => tx.scheduleException.findFirst({ where: { id } }));
  }

  delete(id: string): Promise<ScheduleException> {
    return this.run((tx) => tx.scheduleException.delete({ where: { id } }));
  }
}

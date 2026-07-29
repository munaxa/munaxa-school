import { Injectable } from '@nestjs/common';
import type { Announcement, Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';

@Injectable()
export class AnnouncementRepository extends TenantRepository {
  create(data: Omit<Prisma.AnnouncementUncheckedCreateInput, 'tenantId'>): Promise<Announcement> {
    return this.run((tx, tenantId) =>
      tx.announcement.create({
        data: { ...data, tenantId, publishedById: TenantContextStore.get()?.actorUserId ?? null },
      }),
    );
  }

  findMany(): Promise<Announcement[]> {
    return this.run((tx) =>
      tx.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    );
  }

  sectionExists(sectionId: string): Promise<boolean> {
    return this.run(
      async (tx) => (await tx.section.findFirst({ where: { id: sectionId } })) !== null,
    );
  }
}

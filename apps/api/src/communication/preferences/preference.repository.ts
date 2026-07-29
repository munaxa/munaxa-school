import { Injectable } from '@nestjs/common';
import type { NotificationPreference, Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

export type PreferencePatch = Partial<
  Omit<NotificationPreference, 'id' | 'tenantId' | 'userId' | 'createdAt' | 'updatedAt'>
>;

@Injectable()
export class PreferenceRepository extends TenantRepository {
  /** The caller's preference row, lazily created with opt-in defaults. */
  getOrCreate(userId: string): Promise<NotificationPreference> {
    return this.run(async (tx, tenantId) => {
      const existing = await tx.notificationPreference.findUnique({ where: { userId } });
      if (existing) return existing;
      return tx.notificationPreference.create({ data: { tenantId, userId } });
    });
  }

  update(userId: string, patch: PreferencePatch): Promise<NotificationPreference> {
    return this.run(async (tx, tenantId) => {
      const data = stripUndefined(patch) as Prisma.NotificationPreferenceUpdateInput;
      return tx.notificationPreference.upsert({
        where: { userId },
        create: { tenantId, userId, ...(stripUndefined(patch) as object) },
        update: data,
      });
    });
  }

  /** Bulk fetch preferences for a recipient set (for the engine). Missing rows are absent. */
  async forUsers(userIds: string[]): Promise<Map<string, NotificationPreference>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.run((tx) =>
      tx.notificationPreference.findMany({ where: { userId: { in: userIds } } }),
    );
    return new Map(rows.map((r): [string, NotificationPreference] => [r.userId, r]));
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

import { Injectable } from '@nestjs/common';
import type { NotificationSettings } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

export interface UpdateSettingsInput {
  senderName?: string;
  senderEmail?: string;
  replyToEmail?: string;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
}

/**
 * Per-tenant notification settings. The sender identity is NEVER hardcoded — it is read from here
 * (defaults: "Munaxa Notifications" <notification@munaxa.com>, reply-to support@munaxa.com) and is
 * editable from the Admin Portal.
 */
@Injectable()
export class SettingsRepository extends TenantRepository {
  /** Fetch the tenant settings, lazily creating the default row on first access. */
  getOrCreate(): Promise<NotificationSettings> {
    return this.run(async (tx, tenantId) => {
      const existing = await tx.notificationSettings.findUnique({ where: { tenantId } });
      if (existing) return existing;
      return tx.notificationSettings.create({ data: { tenantId } });
    });
  }

  update(input: UpdateSettingsInput): Promise<NotificationSettings> {
    return this.run(async (tx, tenantId) => {
      await tx.notificationSettings.upsert({
        where: { tenantId },
        create: { tenantId, ...stripUndefined(input) },
        update: stripUndefined(input),
      });
      const updated = await tx.notificationSettings.findUniqueOrThrow({ where: { tenantId } });
      await this.writeAudit(tx, tenantId, {
        action: 'notification.settings.updated',
        entityType: 'NotificationSettings',
        entityId: updated.id,
        metadata: stripUndefined(input),
      });
      return updated;
    });
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

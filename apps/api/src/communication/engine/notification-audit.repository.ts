import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';

/** Append-only audit trail for notification lifecycle actions (created/sent/read/resend/...). */
@Injectable()
export class NotificationAuditRepository extends TenantRepository {
  record(params: {
    notificationId?: string | null;
    action: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<unknown> {
    return this.run((tx, tenantId) =>
      tx.notificationAudit.create({
        data: {
          tenantId,
          notificationId: params.notificationId ?? null,
          action: params.action,
          actorId: TenantContextStore.get()?.actorUserId ?? null,
          ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
        },
      }),
    );
  }
}

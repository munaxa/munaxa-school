import { Injectable } from '@nestjs/common';
import type {
  DeliveryStatus,
  NotificationChannel,
  NotificationDelivery,
  Prisma,
} from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class DeliveryRepository extends TenantRepository {
  /** Create a QUEUED delivery row for a (notification, channel). */
  enqueue(
    notificationId: string,
    channel: NotificationChannel,
    provider: string,
  ): Promise<NotificationDelivery> {
    return this.run((tx, tenantId) =>
      tx.notificationDelivery.create({
        data: { tenantId, notificationId, channel, provider, status: 'QUEUED' },
      }),
    );
  }

  /** Record the outcome of a send attempt (increments attempts; stamps deliveredAt on success). */
  record(
    deliveryId: string,
    status: DeliveryStatus,
    providerResponse?: Record<string, unknown>,
  ): Promise<NotificationDelivery> {
    return this.run((tx) =>
      tx.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status,
          attempts: { increment: 1 },
          ...(providerResponse !== undefined
            ? { providerResponse: providerResponse as Prisma.InputJsonValue }
            : {}),
          ...(status === 'DELIVERED' || status === 'SENT' ? { deliveredAt: new Date() } : {}),
        },
      }),
    );
  }

  findById(deliveryId: string): Promise<NotificationDelivery | null> {
    return this.run((tx) => tx.notificationDelivery.findUnique({ where: { id: deliveryId } }));
  }
}

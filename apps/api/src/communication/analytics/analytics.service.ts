import { Injectable } from '@nestjs/common';
import { TenantRepository } from '../../common/tenant.repository';

export interface NotificationAnalytics {
  rangeDays: number;
  notificationsSent: number;
  volume: number;
  pushDeliveryRate: number;
  emailDeliveryRate: number;
  readRate: number;
  openRate: number;
  failedDeliveries: number;
  topCategories: { category: string; count: number }[];
  dailyTrends: { date: string; count: number }[];
}

const DELIVERED = ['SENT', 'DELIVERED'] as const;

/** Tenant-scoped notification analytics aggregated from Notification + NotificationDelivery. */
@Injectable()
export class AnalyticsService extends TenantRepository {
  async overview(rangeDays = 30): Promise<NotificationAnalytics> {
    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    return this.run(async (tx) => {
      const [
        notificationsSent,
        readCount,
        pushTotal,
        pushDelivered,
        emailTotal,
        emailDelivered,
        failedDeliveries,
        volume,
        byCategory,
      ] = await Promise.all([
        tx.notification.count({ where: { createdAt: { gte: since } } }),
        tx.notification.count({ where: { createdAt: { gte: since }, readAt: { not: null } } }),
        tx.notificationDelivery.count({ where: { createdAt: { gte: since }, channel: 'PUSH' } }),
        tx.notificationDelivery.count({
          where: { createdAt: { gte: since }, channel: 'PUSH', status: { in: [...DELIVERED] } },
        }),
        tx.notificationDelivery.count({ where: { createdAt: { gte: since }, channel: 'EMAIL' } }),
        tx.notificationDelivery.count({
          where: { createdAt: { gte: since }, channel: 'EMAIL', status: { in: [...DELIVERED] } },
        }),
        tx.notificationDelivery.count({ where: { createdAt: { gte: since }, status: 'FAILED' } }),
        tx.notificationDelivery.count({ where: { createdAt: { gte: since } } }),
        tx.notification.groupBy({
          by: ['category'],
          where: { createdAt: { gte: since } },
          _count: { _all: true },
        }),
      ]);

      const trendRows = await tx.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT date_trunc('day', "createdAt") AS date, count(*)::bigint AS count
        FROM "Notification"
        WHERE "createdAt" >= ${since}
        GROUP BY 1
        ORDER BY 1 ASC
      `;

      return {
        rangeDays,
        notificationsSent,
        volume,
        pushDeliveryRate: rate(pushDelivered, pushTotal),
        emailDeliveryRate: rate(emailDelivered, emailTotal),
        readRate: rate(readCount, notificationsSent),
        openRate: rate(readCount, notificationsSent),
        failedDeliveries,
        topCategories: byCategory
          .map((c) => ({ category: c.category, count: c._count._all }))
          .sort((a, b) => b.count - a.count),
        dailyTrends: trendRows.map((r) => ({
          date: r.date.toISOString().slice(0, 10),
          count: Number(r.count),
        })),
      };
    });
  }
}

function rate(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10; // one decimal %
}

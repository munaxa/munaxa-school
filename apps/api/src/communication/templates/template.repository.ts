import { Injectable } from '@nestjs/common';
import type { NotificationChannel, NotificationTemplate } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

export interface TemplateOverrides {
  en?: { subject?: string; body?: string };
  ar?: { subject?: string; body?: string };
}

@Injectable()
export class TemplateRepository extends TenantRepository {
  /** Active IN_APP/EMAIL template bodies for an event, grouped by language, for the renderer. */
  overridesFor(eventType: string, channel: NotificationChannel): Promise<TemplateOverrides> {
    return this.run(async (tx) => {
      const rows = await tx.notificationTemplate.findMany({
        where: { eventType, channel, active: true },
      });
      const out: TemplateOverrides = {};
      for (const r of rows) {
        const lang = r.language === 'ar' ? 'ar' : 'en';
        out[lang] = { subject: r.subject ?? undefined, body: r.body };
      }
      return out;
    });
  }

  list(): Promise<NotificationTemplate[]> {
    return this.run((tx) =>
      tx.notificationTemplate.findMany({ orderBy: [{ eventType: 'asc' }, { language: 'asc' }] }),
    );
  }

  upsert(data: {
    eventType: string;
    channel: NotificationChannel;
    language: string;
    subject?: string | null;
    body: string;
    active?: boolean;
  }): Promise<NotificationTemplate> {
    return this.run((tx, tenantId) =>
      tx.notificationTemplate.upsert({
        where: {
          tenantId_eventType_channel_language: {
            tenantId,
            eventType: data.eventType,
            channel: data.channel,
            language: data.language,
          },
        },
        create: {
          tenantId,
          eventType: data.eventType,
          channel: data.channel,
          language: data.language,
          subject: data.subject ?? null,
          body: data.body,
          active: data.active ?? true,
        },
        update: {
          subject: data.subject ?? null,
          body: data.body,
          active: data.active ?? true,
        },
      }),
    );
  }
}

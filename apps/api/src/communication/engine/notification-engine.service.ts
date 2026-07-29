import { Injectable, Logger } from '@nestjs/common';
import type { NotificationCategory, NotificationPriority } from '@prisma/client';
import { NotificationRepository } from '../notifications/notification.repository';
import { PreferenceRepository } from '../preferences/preference.repository';
import { channelAllowed } from '../preferences/preference.policy';
import { SettingsService } from '../settings/settings.service';
import { TemplateRepository } from '../templates/template.repository';
import { TemplateRenderer } from '../templates/template.renderer';
import { DeliveryRepository } from '../delivery/delivery.repository';
import { PriorityEngine } from './priority.engine';
import { NotificationQueuePort } from '../queue/notification-queue.port';
import type { ChannelJob } from '../queue/channel-job';
import { NotificationAuditRepository } from './notification-audit.repository';
import { EVENT_DEFAULTS, type NotificationEvent } from './notification-events';

export interface DispatchSummary {
  recipients: number;
  notifications: number;
  jobs: number;
}

/**
 * The Notification Engine: the single path every notification flows through. Resolves recipients,
 * enforces preferences + priority + tenant kill-switches, renders bilingual content, persists the
 * in-app notification (source of truth), then enqueues per-channel jobs. Channels are never called
 * synchronously — delivery is queue-driven.
 */
@Injectable()
export class NotificationEngine {
  private readonly logger = new Logger(NotificationEngine.name);

  constructor(
    private readonly notifications: NotificationRepository,
    private readonly preferences: PreferenceRepository,
    private readonly settings: SettingsService,
    private readonly templates: TemplateRepository,
    private readonly renderer: TemplateRenderer,
    private readonly deliveries: DeliveryRepository,
    private readonly priority: PriorityEngine,
    private readonly queue: NotificationQueuePort,
    private readonly audit: NotificationAuditRepository,
  ) {}

  /** Process a domain event end-to-end. Returns a summary; never throws into the producer. */
  async handle(event: NotificationEvent): Promise<DispatchSummary> {
    try {
      return await this.dispatch(event);
    } catch (err) {
      this.logger.error(`Notification dispatch failed for ${event.type}: ${String(err)}`);
      return { recipients: 0, notifications: 0, jobs: 0 };
    }
  }

  private async dispatch(event: NotificationEvent): Promise<DispatchSummary> {
    const defaults = EVENT_DEFAULTS[event.type] ?? { category: 'SYSTEM', priority: 'NORMAL' };
    const category: NotificationCategory = event.category ?? defaults.category;
    const priority: NotificationPriority = event.priority ?? defaults.priority;
    const mandatory = event.mandatory ?? false;

    const userIds = await this.resolveRecipients(event);
    if (userIds.length === 0) return { recipients: 0, notifications: 0, jobs: 0 };

    // Render once (variables are event-level; recipient name vars may already be in context).
    const vars = normalizeVars(event.context);
    const overrides = await this.templates.overridesFor(event.type, 'IN_APP');
    const rendered = this.renderer.render(event.type, vars, overrides);
    const title = event.title ?? rendered.titleEn;
    const body = event.body ?? rendered.bodyEn;

    const sender = await this.settings.sender();
    const [prefs, contacts] = await Promise.all([
      this.preferences.forUsers(userIds),
      this.notifications.recipientContacts(userIds),
    ]);

    const desiredChannels = this.priority.channelsFor(priority);
    const jobs: ChannelJob[] = [];

    for (const userId of userIds) {
      const notification = await this.notifications.createForRecipient({
        userId,
        type: event.type,
        category,
        priority,
        title,
        body,
        titleEn: rendered.titleEn,
        titleAr: rendered.titleAr,
        bodyEn: rendered.bodyEn,
        bodyAr: rendered.bodyAr,
        mandatory,
        data: event.data as never,
        announcementId: event.announcementId ?? null,
      });
      await this.audit.record({
        notificationId: notification.id,
        action: 'notification.created',
        metadata: { type: event.type, category, priority, mandatory },
      });

      const contact = contacts.get(userId);
      let queued = false;

      for (const channel of desiredChannels) {
        const allowed = channelAllowed({
          channel,
          category,
          mandatory,
          tenant: { pushEnabled: sender.pushEnabled, emailEnabled: sender.emailEnabled },
          preference: prefs.get(userId) ?? null,
        });
        if (!allowed) continue;

        if (channel === 'PUSH') {
          if (!contact?.tokens.length) continue;
          const delivery = await this.deliveries.enqueue(notification.id, 'PUSH', 'fcm');
          jobs.push({
            tenantId: notification.tenantId,
            notificationId: notification.id,
            deliveryId: delivery.id,
            channel: 'PUSH',
            tokens: contact.tokens,
            title,
            body,
            language: 'en',
            data: stringData(event.data),
          });
          queued = true;
        } else if (channel === 'EMAIL') {
          if (!contact?.email) continue;
          const delivery = await this.deliveries.enqueue(notification.id, 'EMAIL', 'resend');
          jobs.push({
            tenantId: notification.tenantId,
            notificationId: notification.id,
            deliveryId: delivery.id,
            channel: 'EMAIL',
            email: contact.email,
            title,
            body,
            language: 'en',
            data: { ...stringData(event.data), SchoolName: String(vars.SchoolName ?? '') },
          });
          queued = true;
        }
      }

      if (queued) await this.notifications.setStatus(notification.id, 'SENT');
    }

    await this.queue.enqueueMany(jobs);
    return { recipients: userIds.length, notifications: userIds.length, jobs: jobs.length };
  }

  private resolveRecipients(event: NotificationEvent): Promise<string[]> {
    if ('userIds' in event.recipients) {
      return Promise.resolve([...new Set(event.recipients.userIds)]);
    }
    return this.notifications.resolveRecipients(
      event.recipients.audience,
      event.recipients.sectionId,
    );
  }
}

function normalizeVars(ctx?: Record<string, string | number>): Record<string, string | number> {
  return ctx ?? {};
}

function stringData(data?: Record<string, unknown>): Record<string, string> {
  if (!data) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    out[k] =
      typeof v === 'string'
        ? v
        : typeof v === 'number' || typeof v === 'boolean'
          ? String(v)
          : JSON.stringify(v);
  }
  return out;
}

import { Module } from '@nestjs/common';
import { AnnouncementController } from './announcements/announcement.controller';
import { AnnouncementService } from './announcements/announcement.service';
import { AnnouncementRepository } from './announcements/announcement.repository';
import { NotificationController } from './notifications/notification.controller';
import { NotificationService } from './notifications/notification.service';
import { NotificationRepository } from './notifications/notification.repository';
import { DeviceRepository } from './devices/device.repository';
import { FeatureFlagController } from './feature-flags/feature-flag.controller';
import { FeatureFlagService } from './feature-flags/feature-flag.service';
import { FeatureFlagRepository } from './feature-flags/feature-flag.repository';
import { ChannelDispatcher } from './dispatch/dispatcher.service';
import { PushService } from './dispatch/push.service';
import { EmailChannel } from './dispatch/email.channel';
import { WhatsAppBridge } from './dispatch/whatsapp.bridge';
// Notification platform
import { NotificationEngine } from './engine/notification-engine.service';
import { NotificationEventBus } from './engine/notification-event-bus';
import { NotificationAuditRepository } from './engine/notification-audit.repository';
import { PriorityEngine } from './engine/priority.engine';
import { PreferenceService } from './preferences/preference.service';
import { PreferenceRepository } from './preferences/preference.repository';
import { SettingsController } from './settings/settings.controller';
import { SettingsService } from './settings/settings.service';
import { SettingsRepository } from './settings/settings.repository';
import { TemplateController } from './templates/template.controller';
import { TemplateRepository } from './templates/template.repository';
import { TemplateRenderer } from './templates/template.renderer';
import { DeliveryRepository } from './delivery/delivery.repository';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { NotificationQueuePort } from './queue/notification-queue.port';
import { InProcessQueue } from './queue/in-process-queue.service';

/**
 * Communication & the Notification Platform: announcements, the in-app notification center, device
 * (FCM) tokens, per-user preferences, tenant settings + bilingual templates, the event-driven
 * notification engine (priority + preference + queue), channel dispatch (Push/Email), the delivery
 * ledger, analytics, and per-tenant feature flags.
 *
 * The event bus is exported so any domain module can raise notification events without sending
 * directly. The queue port is bound to the in-process worker (swappable for BullMQ + Redis).
 */
@Module({
  controllers: [
    AnnouncementController,
    NotificationController,
    FeatureFlagController,
    SettingsController,
    TemplateController,
    AnalyticsController,
  ],
  providers: [
    AnnouncementService,
    AnnouncementRepository,
    NotificationService,
    NotificationRepository,
    DeviceRepository,
    FeatureFlagService,
    FeatureFlagRepository,
    // Dispatch channels
    ChannelDispatcher,
    PushService,
    EmailChannel,
    WhatsAppBridge,
    // Engine
    NotificationEngine,
    NotificationEventBus,
    NotificationAuditRepository,
    PriorityEngine,
    // Preferences / settings / templates / delivery / analytics
    PreferenceService,
    PreferenceRepository,
    SettingsService,
    SettingsRepository,
    TemplateRepository,
    TemplateRenderer,
    DeliveryRepository,
    AnalyticsService,
    // Queue (in-process; swap for a BullMQ adapter behind the same port)
    { provide: NotificationQueuePort, useClass: InProcessQueue },
  ],
  exports: [NotificationEventBus],
})
export class CommunicationModule {}

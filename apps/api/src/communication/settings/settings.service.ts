import { Injectable } from '@nestjs/common';
import type { NotificationSettings } from '@prisma/client';
import { SettingsRepository, type UpdateSettingsInput } from './settings.repository';

/** The resolved sender identity used by the email channel. */
export interface SenderIdentity {
  from: string; // "Name <email>"
  replyTo: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
}

@Injectable()
export class SettingsService {
  constructor(private readonly repo: SettingsRepository) {}

  get(): Promise<NotificationSettings> {
    return this.repo.getOrCreate();
  }

  update(input: UpdateSettingsInput): Promise<NotificationSettings> {
    return this.repo.update(input);
  }

  /** Resolve the tenant's sender identity for outbound email (never hardcoded). */
  async sender(): Promise<SenderIdentity> {
    const s = await this.repo.getOrCreate();
    return {
      from: `${s.senderName} <${s.senderEmail}>`,
      replyTo: s.replyToEmail,
      emailEnabled: s.emailEnabled,
      pushEnabled: s.pushEnabled,
    };
  }
}

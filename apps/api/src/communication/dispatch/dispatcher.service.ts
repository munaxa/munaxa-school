import { Injectable } from '@nestjs/common';
import { PushService } from './push.service';
import { EmailChannel } from './email.channel';
import { SettingsService } from '../settings/settings.service';
import type { ChannelJob, DeliveryResult } from '../queue/channel-job';

/**
 * Performs the actual send for a single resolved {@link ChannelJob}. The queue owns retry/backoff
 * and delivery recording; this class only knows how to talk to a channel's provider. Runs inside a
 * tenant context (set by the queue worker) so SettingsService can resolve the sender identity.
 */
@Injectable()
export class ChannelDispatcher {
  constructor(
    private readonly push: PushService,
    private readonly email: EmailChannel,
    private readonly settings: SettingsService,
  ) {}

  async deliver(job: ChannelJob): Promise<DeliveryResult> {
    if (job.channel === 'PUSH') {
      return this.push.deliver(job.tokens ?? [], {
        title: job.title,
        body: job.body,
        data: job.data,
      });
    }
    // EMAIL — resolve the tenant's (never-hardcoded) sender identity.
    const sender = await this.settings.sender();
    return this.email.deliver(job, sender);
  }
}

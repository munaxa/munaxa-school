import { Injectable } from '@nestjs/common';
import { MailService } from '../../mail/mail.service';
import { TemplateRenderer } from '../templates/template.renderer';
import type { SenderIdentity } from '../settings/settings.service';
import type { ChannelJob, DeliveryResult } from '../queue/channel-job';

/**
 * Email channel (Resend). The sender identity (From + Reply-To) is supplied by the tenant's
 * NotificationSettings — it is NEVER hardcoded. Renders the branded, RTL-aware HTML shell plus a
 * plain-text fallback.
 */
@Injectable()
export class EmailChannel {
  constructor(
    private readonly mail: MailService,
    private readonly renderer: TemplateRenderer,
  ) {}

  async deliver(job: ChannelJob, sender: SenderIdentity): Promise<DeliveryResult> {
    if (!job.email) {
      return { ok: false, provider: 'resend', response: { reason: 'no-recipient-email' } };
    }
    const { html, text } = this.renderer.email({
      title: job.title,
      body: job.body,
      language: job.language,
      schoolName: job.data?.SchoolName,
    });
    const result = await this.mail.send({
      to: job.email,
      subject: job.title,
      html,
      text,
      from: sender.from,
      replyTo: sender.replyTo,
    });
    return {
      ok: result.sent,
      provider: 'resend',
      response: { sent: result.sent },
    };
  }
}

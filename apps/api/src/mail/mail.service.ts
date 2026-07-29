import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';

export interface SendMailInput {
  to: string | string[];
  subject: string;
  html: string;
  /** Plain-text alternative (multipart). Recommended for deliverability + non-HTML clients. */
  text?: string;
  /** Override the default From address (e.g. the admin sender for security emails). */
  from?: string;
  /** Reply-To address (e.g. the tenant support inbox from NotificationSettings). */
  replyTo?: string;
  /** Carbon-copy recipients. */
  cc?: string[];
  /** Blind carbon-copy recipients. */
  bcc?: string[];
  /** Optional file attachments (e.g. a generated PDF document). */
  attachments?: Array<{ filename: string; content: Buffer }>;
}

/**
 * Transactional email via Resend's HTTP API. Deliberately dependency-free (global fetch).
 *
 * No-op safe: when RESEND_API_KEY is unset (local dev, CI), sends are skipped and reported as
 * `{ sent: false }` so callers can fall back (e.g. show a temp password on screen instead).
 * Bodies and secrets are NEVER logged — only recipient + subject metadata.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  get enabled(): boolean {
    return Boolean(this.config.get('RESEND_API_KEY', { infer: true }));
  }

  async send(input: SendMailInput): Promise<{ sent: boolean }> {
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true });
    if (!apiKey) return { sent: false };

    const recipients = Array.isArray(input.to) ? input.to.join(', ') : input.to;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: input.from ?? this.config.get('EMAIL_FROM', { infer: true }),
          to: Array.isArray(input.to) ? input.to : [input.to],
          subject: input.subject,
          html: input.html,
          ...(input.text ? { text: input.text } : {}),
          ...(input.replyTo ? { reply_to: input.replyTo } : {}),
          ...(input.cc && input.cc.length > 0 ? { cc: input.cc } : {}),
          ...(input.bcc && input.bcc.length > 0 ? { bcc: input.bcc } : {}),
          ...(input.attachments && input.attachments.length > 0
            ? {
                attachments: input.attachments.map((a) => ({
                  filename: a.filename,
                  content: a.content.toString('base64'),
                })),
              }
            : {}),
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Resend rejected mail to ${recipients} (${res.status})`);
        return { sent: false };
      }
      this.logger.log(`Sent "${input.subject}" to ${recipients}`);
      return { sent: true };
    } catch (err) {
      this.logger.warn(
        `Failed to send mail to ${recipients}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return { sent: false };
    }
  }

  /**
   * Forgot-password email carrying a cryptographically secure, one-time temporary password.
   * Sent from the security/admin sender (EMAIL_FROM_ADMIN, default admin@munaxa.com) with both an
   * HTML and a plain-text body. The temporary password is rendered for the user but NEVER logged.
   */
  async sendTemporaryPassword(params: {
    to: string;
    userName?: string;
    temporaryPassword: string;
  }): Promise<{ sent: boolean }> {
    const userName = params.userName?.trim() || 'there';
    const subject = 'Munaxa Temporary Password';
    const text = [
      `Hello ${userName}`,
      ``,
      `A temporary password has been generated for your account.`,
      ``,
      `Temporary Password:`,
      `${params.temporaryPassword}`,
      ``,
      `This password expires in 24 hours.`,
      ``,
      `For security reasons, you will be required to create a new password immediately after logging in.`,
      ``,
      `If you did not request this reset, contact your school administrator.`,
      ``,
      `Munaxa School OS`,
    ].join('\n');

    const html = [
      `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">`,
      `<h2 style="color:#7A3FFF;margin-bottom:4px">Munaxa Temporary Password</h2>`,
      `<p>Hello ${escapeHtml(userName)}</p>`,
      `<p>A temporary password has been generated for your account.</p>`,
      `<p style="margin-bottom:4px">Temporary Password:</p>`,
      `<p style="font-size:20px;font-family:monospace;background:#f4f0ff;padding:12px 16px;` +
        `border-radius:8px;letter-spacing:1px;margin-top:0">${escapeHtml(params.temporaryPassword)}</p>`,
      `<p><strong>This password expires in 24 hours.</strong></p>`,
      `<p>For security reasons, you will be required to create a new password immediately after logging in.</p>`,
      `<p style="color:#888;font-size:12px">If you did not request this reset, contact your school administrator.</p>`,
      `<p style="color:#888;font-size:12px">Munaxa School OS</p>`,
      `</div>`,
    ].join('');

    return this.send({
      to: params.to,
      subject,
      html,
      text,
      from: this.config.get('EMAIL_FROM_ADMIN', { infer: true }),
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

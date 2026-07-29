import { Resend } from 'resend';
import { themes } from '@axa/platform/themes';
import { CONTACT_EMAIL, CONTACT_FROM_EMAIL, SITE_NAME, SITE_URL } from './site';
import { escapeHtml } from './validation';
import { logger } from './logger';

/** Email HTML cannot read CSS custom properties, so it renders the theme's static hexes. */
const { color: brand, neutral } = themes.school.brand;

let client: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'Munaxa <no-reply@munaxa.com>';

export interface InquiryEmailData {
  name: string;
  schoolName: string;
  email: string;
  phone: string;
  message: string;
  ipAddress: string | null;
  userAgent: string | null;
  submittedAt: Date;
}

/**
 * Sends the visitor-facing welcome / acknowledgment email, confirming receipt of their message
 * and summarizing what they submitted. Design mirrors the Munaxa brand email.
 */
export async function sendAcknowledgmentEmail(data: InquiryEmailData): Promise<void> {
  const resend = getClient();
  if (!resend) {
    logger.warn('email.not_configured', { reason: 'RESEND_API_KEY not set', kind: 'ack' });
    return;
  }

  const firstName = data.name.trim().split(/\s+/)[0] || data.name;

  const text = [
    `Hi ${firstName},`,
    '',
    `Thanks for reaching out to ${SITE_NAME} on behalf of ${data.schoolName}.`,
    '',
    'We have received your message and a member of our team will get back to you within one ' +
      'business day to answer any questions and, when you are ready, arrange a demo.',
    '',
    'Here is a copy of what you sent us:',
    `  Name: ${data.name}`,
    `  School: ${data.schoolName}`,
    `  Phone: ${data.phone}`,
    `  Message: ${data.message}`,
    '',
    'Have more to add? Just reply to this email — it goes straight to our team.',
    '',
    `— The ${SITE_NAME} Team`,
    SITE_URL,
  ].join('\n');

  const html = `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;padding:0;background-color:${neutral.bg};font-family:Helvetica,Arial,sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${neutral.bg};padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${neutral[0]};border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(30,11,77,0.08);">
                <tr>
                  <td style="background-color:${brand.DEFAULT};padding:28px 32px;">
                    <span style="color:${neutral[0]};font-size:20px;font-weight:700;letter-spacing:0.02em;">${escapeHtml(SITE_NAME)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;color:${neutral.ink};font-size:15px;line-height:1.6;">
                    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${neutral.ink};">Thanks for reaching out, ${escapeHtml(firstName)}!</h1>
                    <p style="margin:0 0 16px;">
                      We've received your message on behalf of <strong>${escapeHtml(data.schoolName)}</strong> and a member of
                      our team will be in touch within one business day to answer any questions and, when you are ready, arrange a demo.
                    </p>
                    <p style="margin:0 0 12px;">Here's a copy of what you sent us:</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid ${neutral.border};border-radius:8px;overflow:hidden;">
                      <tr>
                        <td style="padding:10px 14px;background-color:${neutral.surface};font-weight:600;width:120px;border-bottom:1px solid ${neutral.border};vertical-align:top;">Name</td>
                        <td style="padding:10px 14px;border-bottom:1px solid ${neutral.border};">${escapeHtml(data.name)}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 14px;background-color:${neutral.surface};font-weight:600;border-bottom:1px solid ${neutral.border};vertical-align:top;">School</td>
                        <td style="padding:10px 14px;border-bottom:1px solid ${neutral.border};">${escapeHtml(data.schoolName)}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 14px;background-color:${neutral.surface};font-weight:600;border-bottom:1px solid ${neutral.border};vertical-align:top;">Phone</td>
                        <td style="padding:10px 14px;border-bottom:1px solid ${neutral.border};">${escapeHtml(data.phone)}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 14px;background-color:${neutral.surface};font-weight:600;vertical-align:top;">Message</td>
                        <td style="padding:10px 14px;">${escapeHtml(data.message).replace(/\n/g, '<br/>')}</td>
                      </tr>
                    </table>
                    <p style="margin:0 0 24px;">
                      Have more to add? Just reply to this email — it goes straight to our team.
                    </p>
                    <a href="${SITE_URL}" style="display:inline-block;background-color:${brand.DEFAULT};color:${neutral[0]};text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">
                      Visit ${escapeHtml(SITE_URL.replace(/^https?:\/\//, ''))}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 32px;background-color:${neutral.surface};color:${neutral.mutedText};font-size:12px;text-align:center;">
                    ${escapeHtml(SITE_NAME)} — the School Operating System<br/>
                    <a href="mailto:${CONTACT_EMAIL}" style="color:${brand.DEFAULT};text-decoration:none;">${CONTACT_EMAIL}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: data.email,
      subject: `Welcome to ${SITE_NAME} — We've Received Your Message`,
      text,
      html,
    });
  } catch (error) {
    logger.error('email.send_failed', {
      kind: 'ack',
      message: error instanceof Error ? error.message : 'unknown error',
    });
  }
}

/** Sends the internal notification email to the Munaxa sales/info inbox. */
export async function sendInternalNotification(data: InquiryEmailData): Promise<void> {
  const resend = getClient();
  if (!resend) {
    logger.warn('email.not_configured', { reason: 'RESEND_API_KEY not set', kind: 'internal' });
    return;
  }

  const rows: Array<[string, string]> = [
    ['Name', data.name],
    ['School Name', data.schoolName],
    ['Email', data.email],
    ['Phone', data.phone],
    ['Submission Time', data.submittedAt.toISOString()],
    ['IP Address', data.ipAddress ?? 'unknown'],
    ['User Agent', data.userAgent ?? 'unknown'],
  ];

  const html = `
    <h2>New Munaxa contact inquiry</h2>
    <table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(value)}</td></tr>`,
        )
        .join('')}
      <tr><td><strong>Message</strong></td><td>${escapeHtml(data.message).replace(/\n/g, '<br/>')}</td></tr>
    </table>
  `;

  const text = [
    'New Munaxa contact inquiry',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    `Message: ${data.message}`,
  ].join('\n');

  try {
    await resend.emails.send({
      from: CONTACT_FROM_EMAIL,
      to: CONTACT_EMAIL,
      replyTo: data.email,
      subject: `New inquiry from ${data.schoolName}`,
      text,
      html,
    });
  } catch (error) {
    logger.error('email.send_failed', {
      kind: 'internal',
      message: error instanceof Error ? error.message : 'unknown error',
    });
  }
}

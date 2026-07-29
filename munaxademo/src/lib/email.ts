/**
 * Real transactional email for the public "Book a Demo" intake (via Resend).
 *
 * This is the ONLY real outbound integration in the app and is scoped to the public
 * request form — the demo sandbox itself stays hermetic (all its integrations are
 * mocked). Fails soft: if no API key is configured, requests are still stored and the
 * admin queue keeps working; we just skip sending.
 */
import { themes } from '@axa/platform/themes';
import type { DemoRequest } from '@/lib/requests';

/** Email HTML cannot read CSS custom properties, so it renders the theme's static hexes. */
const { neutral } = themes.school.brand;

/** Read a var/secret on both Node (process.env) and Cloudflare Workers (CF env). */
async function readEnv(name: string): Promise<string | undefined> {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const env = getCloudflareContext().env as Record<string, unknown> | undefined;
    const v = env?.[name];
    return typeof v === 'string' && v ? v : undefined;
  } catch {
    return undefined;
  }
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  reply_to?: string;
}

async function sendViaResend(apiKey: string, payload: ResendPayload): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface EmailResult {
  attempted: boolean;
  teamNotified: boolean;
  prospectAcknowledged: boolean;
}

/**
 * Send (1) a notification to the Munaxa team and (2) an acknowledgement to the prospect.
 * Never throws — returns what happened so the caller can still respond 200.
 */
export async function sendDemoRequestEmails(req: DemoRequest): Promise<EmailResult> {
  // Accept either name so delivery works regardless of which secret the operator set:
  // RESEND_DEMO (preferred, demo-scoped key) or RESEND_API_KEY (the name used in the
  // deployment docs and by the sibling landing app).
  const apiKey = (await readEnv('RESEND_DEMO')) || (await readEnv('RESEND_API_KEY'));
  const from = (await readEnv('DEMO_FROM_EMAIL')) || 'Munaxa Demo <demo@munaxa.com>';
  const notify = (await readEnv('DEMO_NOTIFY_EMAIL')) || 'demo@munaxa.com';

  if (!apiKey) return { attempted: false, teamNotified: false, prospectAcknowledged: false };

  const rows: Array<[string, string]> = [
    ['School', req.schoolName],
    ['Contact', req.contactPerson],
    ['Job title', req.jobTitle],
    ['Email', req.email],
    ['Phone', req.phone],
    ['Country', req.country],
    ['Students', String(req.numStudents)],
    ['Campuses', String(req.numCampuses)],
    ['Notes', req.notes],
    ['Received', req.createdAt],
  ];
  const tableRows = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:${neutral.mutedText}">${esc(k)}</td><td style="padding:4px 0"><strong>${esc(v || '—')}</strong></td></tr>`,
    )
    .join('');

  const teamHtml = `
    <div style="font-family:Inter,system-ui,sans-serif;color:${neutral.ink}">
      <h2 style="margin:0 0 12px">New demo request — ${esc(req.schoolName)}</h2>
      <table style="border-collapse:collapse;font-size:14px">${tableRows}</table>
      <p style="margin-top:16px;color:${neutral.mutedText}">Review and provision access in the Demo Requests console.</p>
    </div>`;

  const prospectHtml = `
    <div style="font-family:Inter,system-ui,sans-serif;color:${neutral.ink};max-width:520px">
      <h2 style="margin:0 0 12px">Thank you for your interest in Munaxa</h2>
      <p style="color:${neutral.mutedText};line-height:1.6">
        Hi ${esc(req.contactPerson || 'there')},<br/><br/>
        We’ve received your demo request for <strong>${esc(req.schoolName)}</strong>.
        Our team will review it and reply as soon as possible with your private demo access.
      </p>
      <p style="color:${neutral.mutedText};line-height:1.6">
        If you need anything in the meantime, just reply to this email.
      </p>
      <p style="margin-top:20px;color:${neutral.mutedText};font-size:13px">— The Munaxa team</p>
    </div>`;

  const [team, prospect] = await Promise.allSettled([
    sendViaResend(apiKey, {
      from,
      to: [notify],
      reply_to: req.email,
      subject: `New demo request — ${req.schoolName}`,
      html: teamHtml,
    }),
    sendViaResend(apiKey, {
      from,
      to: [req.email],
      reply_to: notify,
      subject: 'We received your Munaxa demo request',
      html: prospectHtml,
    }),
  ]);

  return {
    attempted: true,
    teamNotified: team.status === 'fulfilled' && team.value,
    prospectAcknowledged: prospect.status === 'fulfilled' && prospect.value,
  };
}

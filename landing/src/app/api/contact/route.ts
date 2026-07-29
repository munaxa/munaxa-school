import { NextResponse, type NextRequest } from 'next/server';
import { contactFormSchema } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendAcknowledgmentEmail, sendInternalNotification } from '@/lib/email';
import { logger, maskIp } from '@/lib/logger';

export const runtime = 'nodejs';

const RATE_LIMIT = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes per IP

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]!.trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '0.0.0.0';
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent');

  // 1. Per-IP sliding-window rate limit.
  const rateLimit = checkRateLimit(`contact:${ip}`, RATE_LIMIT, RATE_LIMIT_WINDOW_MS);
  if (!rateLimit.allowed) {
    logger.warn('contact.rate_limited', { ip: maskIp(ip) });
    return NextResponse.json(
      { ok: false, error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  // 2. Parse + validate.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = contactFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Please check the form for errors.', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // 3. Honeypot — silently accept so bots don't learn they were detected.
  if (data.website) {
    logger.warn('contact.honeypot_triggered', { ip: maskIp(ip) });
    return NextResponse.json({ ok: true });
  }

  const emailData = {
    name: data.name,
    schoolName: data.schoolName,
    email: data.email,
    phone: data.phone,
    message: data.message,
    ipAddress: ip,
    userAgent,
    submittedAt: new Date(),
  };

  // 4. Notify: welcome/acknowledgment to the visitor + internal notification to the sales inbox.
  await Promise.all([sendAcknowledgmentEmail(emailData), sendInternalNotification(emailData)]);

  logger.info('contact.submitted', { ip: maskIp(ip), school: data.schoolName });

  return NextResponse.json({ ok: true });
}

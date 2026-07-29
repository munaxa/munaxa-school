import { NextResponse, type NextRequest } from 'next/server';
import { createRequest } from '@/lib/requests';
import { rateLimited } from '@/lib/auth/session';
import { assertSameOrigin, clamp } from '@/lib/http';
import { sendDemoRequestEmails } from '@/lib/email';

export const runtime = 'nodejs';

function ipOf(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

const cap = (n: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(n) || 0)));

/** Public "Book a Demo" submission. No auth; same-origin + rate-limited. Never issues credentials. */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  if (rateLimited(`req:${ipOf(req)}`)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Clamp every field to a sane maximum to prevent memory-abuse / oversized payloads.
  const schoolName = clamp(body.schoolName, 120);
  const contactPerson = clamp(body.contactPerson, 120);
  const email = clamp(body.email, 160);

  if (!schoolName || !contactPerson || !email) {
    return NextResponse.json(
      { error: 'School name, contact person and email are required.' },
      { status: 400 },
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const request = createRequest({
    schoolName,
    contactPerson,
    jobTitle: clamp(body.jobTitle, 80),
    country: clamp(body.country, 64),
    numStudents: cap(body.numStudents, 200000),
    numCampuses: cap(body.numCampuses, 1000),
    email,
    phone: clamp(body.phone, 40),
    notes: clamp(body.notes, 2000),
  });

  // Notify the team (demo@munaxa.com) and acknowledge the prospect. Fail-soft: a
  // mail error never blocks the submission — the request is already stored.
  await sendDemoRequestEmails(request).catch(() => undefined);

  // The team reviews and contacts the prospect; no account is created here.
  return NextResponse.json({ ok: true });
}

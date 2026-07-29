import { NextResponse, type NextRequest } from 'next/server';
import { cookieName, cookieOptions } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const res = NextResponse.json({ ok: true });
  // Clearing the cookie ends the access session; the client wipes session data too.
  res.cookies.set(cookieName(), '', {
    ...cookieOptions(process.env.NODE_ENV === 'production'),
    maxAge: 0,
  });
  return res;
}

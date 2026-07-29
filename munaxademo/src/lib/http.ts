/**
 * HTTP security helpers shared by route handlers.
 *
 * `assertSameOrigin` is CSRF defense-in-depth: even though the session cookie is
 * SameSite=Strict (so it isn't sent on cross-site requests), we also reject any
 * state-changing request whose Origin/Referer doesn't match the host. Requests with
 * no Origin/Referer at all (e.g. server-to-server, curl) are allowed — the cookie
 * check still gates authenticated actions.
 */
import { NextResponse, type NextRequest } from 'next/server';

function expectedHost(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-host') ?? req.headers.get('host');
}

export function isSameOrigin(req: NextRequest): boolean {
  const host = expectedHost(req);
  if (!host) return false;
  const source = req.headers.get('origin') ?? req.headers.get('referer');
  if (!source) return true; // no browser-set origin → not a cross-site form post
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

/** Returns a 403 response if the request is cross-origin, otherwise null. */
export function assertSameOrigin(req: NextRequest): NextResponse | null {
  return isSameOrigin(req)
    ? null
    : NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
}

/** Clamp untrusted string input to a maximum length (prevents memory abuse). */
export function clamp(value: unknown, max: number): string {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

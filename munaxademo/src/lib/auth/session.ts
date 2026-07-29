/** Session cookie helpers + a tiny in-memory login rate-limiter. */
import { cookies } from 'next/headers';
import { verifySession, type SessionClaims } from './token';

/**
 * Cookie name. In production we use the `__Host-` prefix, which browsers only accept
 * when the cookie is Secure, Path=/ and has no Domain — preventing subdomain/edge
 * cookie injection (cookie tossing). In dev (plain http) the prefix can't be used.
 */
export function cookieName(): string {
  return process.env.NODE_ENV === 'production'
    ? '__Host-munaxa_demo_session'
    : 'munaxa_demo_session';
}

/**
 * Cookie options. Note: NO `maxAge`/`expires` → this is a SESSION cookie, so it is
 * cleared automatically when the browser closes (one of the required reset triggers).
 * Token expiry is enforced separately via the signed `exp` claim. `__Host-` requires
 * secure + path=/ + no domain, all satisfied here.
 */
export function cookieOptions(isProd: boolean) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: isProd,
    path: '/',
  };
}

/** Read & verify the session from the request cookies (server components / routes). */
export async function getServerSession(): Promise<SessionClaims | null> {
  const jar = await cookies();
  return verifySession(jar.get(cookieName())?.value);
}

/* ── Login rate limiter (in-memory, resets on restart). ── */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 5 * 60_000;
const MAX = 8;

export function rateLimited(keyId: string): boolean {
  const now = Date.now();
  const rec = attempts.get(keyId);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(keyId, { count: 1, first: now });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX;
}

export function clearRateLimit(keyId: string): void {
  attempts.delete(keyId);
}

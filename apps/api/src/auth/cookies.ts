import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';

/**
 * httpOnly cookie session for the web admin (mobile/API clients keep using Bearer tokens).
 *
 * - munaxa_at / munaxa_rt: httpOnly, Secure (prod), SameSite=Strict — never readable by JS, so an
 *   XSS cannot exfiltrate the session. SameSite=Strict also blocks cross-site CSRF on its own.
 * - munaxa_csrf: a readable companion token for the double-submit CSRF check (defense in depth):
 *   the client echoes it in the X-CSRF-Token header on mutating requests and the CsrfGuard
 *   verifies header === cookie (an attacker can't read it cross-origin nor forge the header).
 */
export const ACCESS_COOKIE = 'munaxa_at';
export const REFRESH_COOKIE = 'munaxa_rt';
export const CSRF_COOKIE = 'munaxa_csrf';
export const CSRF_HEADER = 'x-csrf-token';

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Set the access/refresh/csrf cookies for a freshly-issued token pair. Returns the csrf token. */
export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  ttl: { accessTtl: number; refreshTtl: number },
): string {
  const secure = isProd();
  const base = { httpOnly: true, secure, sameSite: 'strict' as const, path: '/' };
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...base, maxAge: ttl.accessTtl * 1000 });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...base, maxAge: ttl.refreshTtl * 1000 });
  const csrf = randomBytes(32).toString('base64url');
  // Readable by the client (httpOnly: false) so it can echo it back in the request header.
  res.cookie(CSRF_COOKIE, csrf, {
    httpOnly: false,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: ttl.refreshTtl * 1000,
  });
  return csrf;
}

/** Clear the session cookies (logout / failed refresh). */
export function clearAuthCookies(res: Response): void {
  const secure = isProd();
  const base = { secure, sameSite: 'strict' as const, path: '/' };
  res.clearCookie(ACCESS_COOKIE, { ...base, httpOnly: true });
  res.clearCookie(REFRESH_COOKIE, { ...base, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false });
}

/** The refresh token from the cookie, when the caller is a cookie (web) session. */
export function refreshTokenFromCookie(req: Request): string | undefined {
  return (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
}

/** The access token from the cookie, when present (web session). */
export function accessTokenFromCookie(req: Request): string | undefined {
  return (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
}

import { NextResponse, type NextRequest } from 'next/server';

/**
 * Host-based separation of the two audiences that share this one Next.js app:
 *
 *   - the School Admin Portal (customers)      → NEXT_PUBLIC_APP_HOST      (e.g. app.munaxa.com)
 *   - the Platform Console (Munaxa employees)  → NEXT_PUBLIC_CONSOLE_HOST  (e.g. admin.munaxa.com)
 *
 * Both hostnames point at the SAME deployment (one Render service, two custom domains). Because
 * they are different origins, the browser already keeps their session cookies in separate jars —
 * this middleware adds the visible separation on top: the console host serves ONLY `/platform/*`,
 * and the app host BLOCKS `/platform/*`. Auth pages and the `/api` proxy are shared.
 *
 * Fail-open by design: if neither host env is set (local dev, or a single-domain deploy), or the
 * request arrives on some other hostname (a *.onrender.com preview URL), nothing is restricted —
 * the app behaves exactly as it did before. The API still enforces every permission server-side,
 * so this is UX/hardening, not the security boundary.
 */

const CONSOLE_HOST = (
  process.env.NEXT_PUBLIC_CONSOLE_HOST ??
  process.env.CONSOLE_HOST ??
  ''
).toLowerCase();
const APP_HOST = (process.env.NEXT_PUBLIC_APP_HOST ?? process.env.APP_HOST ?? '').toLowerCase();

/** Auth flows must work on both hosts (employees and school users both sign in here). */
function isAuthPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/change-password') ||
    pathname.startsWith('/forgot-password')
  );
}

function isPlatformPath(pathname: string): boolean {
  return pathname === '/platform' || pathname.startsWith('/platform/');
}

export function middleware(req: NextRequest): NextResponse {
  // Single-domain mode (dev / current deploy): do nothing.
  if (!CONSOLE_HOST && !APP_HOST) return NextResponse.next();

  const host = (req.headers.get('host') ?? '').split(':')[0]?.toLowerCase() ?? '';
  const { pathname } = req.nextUrl;

  // Console host: only the Platform Console (+ auth) is reachable; send everything else there.
  if (CONSOLE_HOST && host === CONSOLE_HOST) {
    if (isPlatformPath(pathname) || isAuthPath(pathname)) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = '/platform/console';
    return NextResponse.redirect(url);
  }

  // App host: the school portal only; platform routes are off-limits here.
  if (APP_HOST && host === APP_HOST) {
    if (isPlatformPath(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Unknown host (e.g. a platform preview URL): don't restrict.
  return NextResponse.next();
}

export const config = {
  // Run on pages only. Skip the API proxy, Next internals, and any static file (has a dot).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};

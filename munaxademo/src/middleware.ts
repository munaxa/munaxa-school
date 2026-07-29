import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth/token';
import { cookieName } from '@/lib/auth/session';
import { isIndexablePath } from '@/lib/seo';

/**
 * Tags every response as noindex/nofollow except the explicitly public, indexable pages
 * (e.g. /request-demo). This X-Robots-Tag header is defence-in-depth alongside the
 * per-route `robots` metadata, guaranteeing authenticated screens never leak into search.
 */
function withRobots(res: NextResponse, pathname: string): NextResponse {
  if (!isIndexablePath(pathname)) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return res;
}

/**
 * Access gate. The demo is NOT publicly accessible: every route except the login
 * page and the auth endpoints requires a valid, unexpired, signed session cookie.
 * Expired/forged cookies are rejected here before any page or data is served.
 */
const PUBLIC_PATHS = [
  '/login',
  '/request-demo',
  '/sitemap.xml',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/requests',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isPublic(pathname)) return withRobots(NextResponse.next(), pathname);

  const token = req.cookies.get(cookieName())?.value;
  const claims = await verifySession(token);

  if (!claims) {
    // API → 401 JSON; pages → redirect to login (preserving intended destination).
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname !== '/' ? `?next=${encodeURIComponent(pathname + search)}` : '';
    return NextResponse.redirect(url);
  }

  // Demo-account management is admin-only.
  if ((pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) && !claims.admin) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return withRobots(NextResponse.next(), pathname);
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|munaxa-logo.png|robots.txt).*)',
  ],
};

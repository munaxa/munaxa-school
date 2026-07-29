/**
 * SEO configuration for the Munaxa live-demo app (demo.munaxa.com).
 *
 * The demo is a functional, mostly-authenticated application, so it is noindex BY DEFAULT
 * (see the root layout). Only genuinely public, prospect-facing pages — currently the
 * "Request a Demo" page — opt back in to indexing. Everything else (login, dashboards,
 * every authenticated screen, the API) stays out of the index, reinforced by a robots.ts
 * disallow list and an X-Robots-Tag header in middleware.
 */
export const DEMO_SITE_URL = (
  process.env.NEXT_PUBLIC_DEMO_SITE_URL ?? 'https://demo.munaxa.com'
).replace(/\/+$/, '');

/** Public marketing URL, used for canonical cross-linking back to the main site. */
export const MARKETING_SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.munaxa.com'
).replace(/\/+$/, '');

/** Paths that are intentionally public AND indexable on the demo subdomain. */
export const INDEXABLE_PATHS = ['/request-demo'] as const;

export function isIndexablePath(pathname: string): boolean {
  return (INDEXABLE_PATHS as readonly string[]).some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function demoUrl(path = '/'): string {
  if (!path || path === '/') return `${DEMO_SITE_URL}/`;
  return `${DEMO_SITE_URL}/${path.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

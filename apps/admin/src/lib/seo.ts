import type { Metadata } from 'next';

/**
 * SEO helpers for the admin portal. The portal is never indexed (see the root layout,
 * robots.ts and the X-Robots-Tag header in next.config). These helpers exist only to give
 * the public auth pages (login / password reset / change) a clean self-referential
 * canonical, so query-string variants (?next=…, ?token=…) consolidate to one URL and do
 * not create duplicate or soft-404 signals.
 */
export const ADMIN_SITE_URL = (
  process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://app.munaxa.com'
).replace(/\/+$/, '');

/** Metadata for an auth page: self-canonical + explicit noindex/nofollow. */
export function authPageMetadata(path: string, title: string): Metadata {
  const canonicalPath = `/${path.replace(/^\/+/, '').replace(/\/+$/, '')}`;
  return {
    metadataBase: new URL(ADMIN_SITE_URL),
    title,
    alternates: { canonical: canonicalPath },
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  };
}

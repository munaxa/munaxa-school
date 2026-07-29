import type { MetadataRoute } from 'next';
import { DEMO_SITE_URL } from '@/lib/seo';

/**
 * The demo subdomain exposes only one indexable page (/request-demo). Everything else —
 * login, the API and every authenticated application route — is disallowed to keep the
 * functional demo app out of search results and prevent crawl traps / index bloat.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/request-demo'],
        disallow: [
          '/login',
          '/api/',
          '/dashboard',
          '/students',
          '/admissions',
          '/attendance',
          '/academics',
          '/finance',
          '/hr',
          '/transport',
          '/library',
          '/events',
          '/communication',
          '/reports',
          '/analytics',
          '/admin',
          '/portal',
          '/styleguide',
        ],
      },
    ],
    sitemap: `${DEMO_SITE_URL}/sitemap.xml`,
    host: DEMO_SITE_URL,
  };
}

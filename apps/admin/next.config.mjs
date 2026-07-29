import { withSentryConfig } from '@sentry/nextjs';

const isProd = process.env.NODE_ENV === 'production';

// connect-src must allow the API origin (and Sentry ingestion when configured).
const apiOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_API_URL ? new URL(process.env.NEXT_PUBLIC_API_URL).origin : '';
  } catch {
    return '';
  }
})();

// Pragmatic CSP for a client-rendered Next app without nonce plumbing: blocks external
// script injection, framing, and form exfiltration. 'unsafe-inline' for script/style is
// required by Next's hydration bootstrap; tightening to nonces is a future refinement.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} https://*.ingest.sentry.io`.replace(/\s+/g, ' ').trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-contained server bundle for the slim production Docker image.
  output: 'standalone',
  experimental: {
    typedRoutes: true,
  },
  // Same-origin reverse proxy to the API. The browser calls /api/v1/* on the admin's own origin,
  // so the httpOnly session cookies are first-party (SameSite=Strict works regardless of where the
  // API is hosted). The admin's own /api/health route is unaffected (only /api/v1/* is proxied).
  // Target precedence: API_PROXY_TARGET → origin of NEXT_PUBLIC_API_URL → localhost:4000.
  async rewrites() {
    const fromPublic = (() => {
      try {
        return process.env.NEXT_PUBLIC_API_URL
          ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
          : '';
      } catch {
        return '';
      }
    })();
    const apiTarget = (process.env.API_PROXY_TARGET || fromPublic || 'http://localhost:4000').replace(
      /\/+$/,
      '',
    );
    return [{ source: '/api/v1/:path*', destination: `${apiTarget}/api/v1/:path*` }];
  },
  // Security headers (OWASP A05). CSP is production-only: dev needs eval for fast refresh.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // The admin portal is an authenticated application and must never be indexed.
          // This header is applied to every response (HTML and non-HTML) as the primary,
          // crawler-agnostic noindex signal, alongside the robots metadata + robots.txt.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          ...(isProd
            ? [
                { key: 'Content-Security-Policy', value: csp },
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains',
                },
              ]
            : []),
        ],
      },
    ];
  },
};

const sentryOptions = {
  silent: true,
  // Org/project are read from env in CI; no secrets committed.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
};

export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryOptions)
  : nextConfig;

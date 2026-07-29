import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
// The demo is a pnpm-workspace member, so trace from the workspace root (the repository root,
// two levels up from school/munaxademo): this both pulls the workspace deps (@axa/platform)
// into the standalone bundle and produces the monorepo-nested layout
// (.next/standalone/school/munaxademo/.next/...) that the OpenNext Cloudflare adapter expects.
// Pinning this to projectRoot breaks the OpenNext bundling step.
const monorepoRoot = path.join(projectRoot, '..', '..');

/** @type {import('next').NextConfig} */

// The demo is hermetic: it makes NO outbound calls. CSP locks every fetch to 'self'
// so the browser physically cannot reach JoFotara / SMS / email / WhatsApp / push /
// payment endpoints — all integrations are mocked in-process (lib/mock-integrations).
const isProd = process.env.NODE_ENV === 'production';

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // ESLint runs as its own workspace step (`pnpm lint` → eslint.config.mjs), so we don't
  // double-lint inside `next build`. Keeps the build focused on compilation.
  eslint: { ignoreDuringBuilds: true },
  // Self-contained server bundle for a slim production container / cloud deploy.
  output: 'standalone',
  // Competitor protection: never ship readable source maps to the browser.
  productionBrowserSourceMaps: false,
  // Trace from the monorepo root so workspace deps are bundled and the standalone layout
  // matches what the OpenNext Cloudflare adapter expects (see monorepoRoot note above).
  outputFileTracingRoot: monorepoRoot,
  typedRoutes: true,
  // The Cloudflare adapter is resolved at runtime (only on Workers); don't bundle it
  // into the Node build. On non-Cloudflare hosts the dynamic import simply no-ops.
  serverExternalPackages: ['@opennextjs/cloudflare'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()',
          },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'Origin-Agent-Cluster', value: '?1' },
          ...(isProd
            ? [
                { key: 'Content-Security-Policy', value: csp },
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
              ]
            : []),
        ],
      },
      {
        // Never cache API responses (they may carry session-scoped data).
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ];
  },
};

export default nextConfig;

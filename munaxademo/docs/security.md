# Munaxa Demo — Security Model

The demo is intentionally hermetic. This document describes the boundaries and the controls.

## What the demo can and cannot reach

| Concern                | Status in the demo                                                    |
| ---------------------- | --------------------------------------------------------------------- |
| Production database    | **Never connected.** There is no database driver and no `DATABASE_URL`. |
| Production APIs/auth    | **Never connected.** No API base URL; the demo has its own auth.       |
| Production storage/files| **Never connected.**                                                  |
| JoFotara e-invoicing   | **Mocked.** `lib/mock-integrations` returns a fake clearance UUID.     |
| SMS / Email / WhatsApp | **Mocked.** Recorded to an in-app outbox; nothing is sent.            |
| Push notifications     | **Mocked.**                                                           |
| Payment gateways       | **Mocked.** Returns a fake authorization; no charge occurs.           |

A strict **Content-Security-Policy** (`connect-src 'self'`) means the browser physically cannot
open a connection to any external host, even if code attempted to. The full policy also sets
`default-src 'self'`, `frame-src 'none'`, `frame-ancestors 'none'`, `object-src 'none'`,
`base-uri 'self'`, `form-action 'self'`, `worker-src 'self' blob:`, `manifest-src 'self'`,
`media-src 'self'` and `upgrade-insecure-requests` (see `next.config.mjs`).

**Security headers** (all responses): `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`, a locked-down `Permissions-Policy` (camera/mic/geo/payment/usb/…
all `()`), `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`,
`X-Permitted-Cross-Domain-Policies: none`, `X-DNS-Prefetch-Control: off`, `Origin-Agent-Cluster`,
`X-Robots-Tag: noindex`, and in production HSTS (`max-age=2y; includeSubDomains; preload`). API
responses are sent `Cache-Control: no-store`.

## Access control

- **Not publicly accessible.** `middleware.ts` requires a valid session on every route except the
  login page, the public "Book a Demo" form (`/request-demo`, `POST /api/requests`) and the auth
  endpoints. There are **no shared/public credentials** — access is provisioned per prospect from
  an approved demo request, so competitors cannot self-serve their way in.
- **Single-role sessions.** Every prospect session is pinned to one persona (its assigned role, or
  the role chosen at login) and the in-app role switcher is hidden — a Student can never switch to,
  or view, another role's data. Only the demo-admin console may switch roles.
- **Signed sessions.** The session token is an HMAC-SHA256-signed payload (Web Crypto), set as an
  **httpOnly, SameSite=Strict, Secure** (in production) cookie that uses the **`__Host-` prefix**
  in production (browser-enforced: Secure + Path=/ + no Domain → no cookie tossing). It carries an
  absolute expiry (`exp`) verified on every request.
- **Session cookie, not persistent.** No `maxAge`/`expires` → cleared when the browser closes.
- **CSRF defense-in-depth.** Beyond SameSite=Strict, every state-changing request (login, logout,
  account & request mutations, public submissions) is rejected if its Origin/Referer doesn't match
  the host (`assertSameOrigin`).
- **Account lifecycle.** Demo accounts have a status (Active/Disabled) and an optional expiry.
  Disabled or expired accounts are rejected at login and cannot hold a usable session.
- **Password storage.** Account passwords are **PBKDF2-HMAC-SHA256** hashed at the OWASP-recommended
  **600,000 iterations** (work factor stored per-hash), compared in constant time. Plaintext is
  never stored at rest.
- **Input hardening.** All untrusted fields are length-clamped before use to prevent oversized-payload
  abuse.
- **Brute-force protection.** An in-memory limiter throttles repeated failed logins per IP+user, and
  public demo requests per IP.
- **Admin separation.** Only the demo-admin account can reach `/admin/*` and `/api/admin/*`
  (enforced in middleware **and** in the route handlers).
- **Fails closed on misconfig.** In production the app refuses to sign/verify sessions unless a
  strong `DEMO_SESSION_SECRET` (≥ 16 chars) is set — it will not fall back to the dev key.

## Competitor protection

The demo exposes **features and workflows only**:

- No production source, API documentation, Swagger, database schema or infrastructure details are
  shipped or referenced in the UI.
- Browser source maps are disabled in production (`productionBrowserSourceMaps: false`).
- Error messages are generic; internal identifiers are not surfaced.

## Secrets

The only secret is `DEMO_SESSION_SECRET` (HMAC key for the session cookie). It is **required in
production** (≥ 16 chars) — the app fails closed rather than using the dev fallback. A dev-only
fallback applies solely when `NODE_ENV !== 'production'`. There are no third-party API keys, because
there are no third-party integrations.

## Residual notes

- Admin-created demo accounts persist in **Cloudflare KV** (on Workers) or a **JSON file** (on a
  Node host) — no SQL database. Login history stays in memory. The explorable school dataset is
  always in-browser and resets on logout/refresh/close.
- On Cloudflare Workers, set the Worker to the **Standard** plan (or lower `DEMO_PBKDF2_ITERATIONS`)
  so PBKDF2 hashing fits the CPU limit; `DEMO_SESSION_SECRET` must be set as a Worker secret.

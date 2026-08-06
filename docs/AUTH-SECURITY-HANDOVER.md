# Munaxa School — Authentication Security Handover

**Purpose:** hand this document to an external reviewer (e.g. ChatGPT) for an independent security
assessment of the authentication surface of this multi-tenant School SaaS.
**Scope:** login, change password, forgot/reset password, and wrong-password / failed-attempt
handling. Session issuance, cookies, CSRF, throttling and lockout are included because they are
inseparable from those flows.
**Status:** read-only review. No code was modified to produce this document.
**Date:** 2026-08-06
**Repo:** `munaxa/munaxa-school` (pnpm monorepo, Turborepo)

---

## 1. System overview

| Component | Stack | Role in auth |
|---|---|---|
| `apps/api` | NestJS 11 + Prisma 6 + PostgreSQL | Authoritative auth server. Issues JWT access tokens + opaque refresh tokens, owns password hashing/policy, lockout, audit. |
| `apps/admin` | Next.js (App Router, client components) | School Admin Portal + Platform Console. Same deployment, two hostnames. Talks to the API through a same-origin reverse proxy at `/api/v1/*`, so session cookies are first-party. |
| `apps/mobile` | Flutter | Bearer-token client. Tokens in `flutter_secure_storage`. |
| `munaxademo` | Next.js, standalone | **Separate** sales-demo app with its own HMAC-cookie session and an in-memory/JSON account store. Not part of the production tenant auth; called out here only so the reviewer does not confuse the two. |
| `landing` | Next.js | Marketing site. No auth. |

Multi-tenancy: every `User` belongs to a `Tenant`. A login handle may be an email, a username, or a
national ID; a `tenantSlug` ("school code") disambiguates when the handle exists in more than one
tenant. Row-level tenant isolation is enforced by `TenantIsolationGuard` and Prisma helpers
(`withPlatform` / tenant context) — out of scope here but relevant to blast radius.

### Global guard chain (`apps/api/src/app.module.ts`, in order)

```
ThrottlerGuard → JwtAuthGuard → MustChangePasswordGuard → CsrfGuard
→ PermissionsGuard → PlanFeatureGuard → ReadOnlyStateGuard → TenantIsolationGuard
```

Global `ValidationPipe` runs with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
`helmet()`, `compression()`, `cookieParser()`, CORS with `credentials: true` against an allow-list
from `CORS_ORIGINS`, and `trust proxy = 1`.

### Key files

```
apps/api/src/auth/auth.controller.ts                  # routes + per-route throttles
apps/api/src/auth/services/auth.service.ts            # login / refresh / logout / change / reset
apps/api/src/auth/services/password.service.ts        # scrypt hashing, policy, HIBP, temp passwords
apps/api/src/auth/services/token.service.ts           # JWT access + opaque refresh
apps/api/src/auth/services/firebase.service.ts        # Firebase ID-token verification
apps/api/src/auth/cookies.ts                          # httpOnly session cookies + CSRF cookie
apps/api/src/auth/guards/{jwt-auth,csrf,must-change-password,permissions,tenant-isolation}.guard.ts
apps/api/src/auth/dto/auth.dto.ts                     # request validation
apps/api/src/users/users.repository.ts                # admin-initiated password reset
apps/api/src/mail/mail.service.ts                     # Resend transactional email
apps/admin/src/lib/{auth,login-guard,login-validation,password-policy,session}.ts
apps/admin/src/app/{login,change-password,forgot-password}/page.tsx
apps/admin/src/components/shell.tsx                   # client idle timeout + mcp redirect
prisma/schema.prisma                                  # User, RefreshToken, PasswordResetToken,
                                                      # PasswordResetAudit, AuditLog
```

---

## 2. Endpoint inventory

| Method | Path | Auth | Throttle (per IP) | Notes |
|---|---|---|---|---|
| POST | `/api/v1/auth/login` | public | 20 / 60s | Returns token pair + `mustChangePassword`; also sets cookies |
| POST | `/api/v1/auth/session` | public | 20 / 60s | Firebase ID token → Munaxa token pair |
| POST | `/api/v1/auth/refresh` | public | 60 / 60s | Rotation + reuse detection; token from body or cookie |
| POST | `/api/v1/auth/logout` | public | global (120/60s) | Revokes the whole refresh-token family |
| POST | `/api/v1/auth/password/reset/request` | public | 5 / 60s | Always `202`; issues a temporary password by email |
| POST | `/api/v1/auth/password/reset/confirm` | public | 10 / 60s | Token-based reset (see finding **F-1**) |
| POST | `/api/v1/auth/password/change` | authenticated | 10 / 60s | Allowed while `mustChangePassword` |
| GET | `/api/v1/auth/me` | authenticated | global | Allowed while `mustChangePassword` |
| POST | `/api/v1/users/:id/reset-password` | authenticated + permission | global | Admin-initiated reset; temp password returned in the response body |

Global throttle default: `THROTTLE_LIMIT=120` per `THROTTLE_TTL=60`s. Throttling is **skipped
entirely when `NODE_ENV=test`**.

---

## 3. Flow-by-flow description

### 3.1 Login — `POST /auth/login`

Client (`apps/admin/src/app/login/page.tsx`):
1. Sanitises inputs (`login-validation.ts`): strips control chars, strips `<`/`>` from the
   identifier, lowercases + `[a-z0-9-]`-filters the school code, caps lengths
   (identifier 254, password 128, school code 64). Passwords are **not** trimmed or rewritten.
2. Validates shape client-side, returning i18n keys.
3. Applies a **client-side guard** (`login-guard.ts`, `localStorage`): 5 submits / 60s rolling
   window, and a 15-minute lockout after 5 failures. Explicitly documented as UX/deterrent only.
4. `fetch` with `credentials: 'include'`; on success routes to `/change-password` when
   `mustChangePassword`, else `/`.
5. "Remember me" persists identifier + school code (not the password) in `localStorage`.

Server (`AuthService.login`), all inside one transaction that **returns an outcome instead of
throwing**, so failure audit rows commit before the HTTP error is raised:

1. Resolve handle → user. Email-shaped handles resolve by email; otherwise `username OR nationalId`.
   With a `tenantSlug` the lookup is tenant-scoped; without one the handle must be globally unique.
2. Unknown user or user without a `passwordHash` → audit `auth.login.failed`, return `invalid`.
3. **Per-account lockout** (`isLockedOut`): counts `auth.login.failed` audit rows for that user since
   `max(lastLoginAt, now-15min)`. `>= 5` → audit `auth.login.locked`, return `blocked` (403), *even
   with the correct password*.
4. Verify the password (`PasswordService.verify`).
5. Wrong password → audit `auth.login.failed`, return `invalid`.
6. Expired temporary password (`mustChangePassword` **and** `passwordResetExpiresAt < now`) →
   audit `auth.password.reset.expired` + reset-audit row, return `blocked` (403).
7. Account state: `deletedAt` / `DISABLED` → "Account is disabled"; `SUSPENDED` → "Account is
   suspended" (403).
8. First login on a freshly issued temporary password → audit `auth.password.reset.first_login`.
9. **Transparent KDF upgrade**: legacy bcrypt hashes are re-hashed with scrypt on success.
10. Build the principal (roles + permissions via `RbacService`), issue tokens, stamp `lastLoginAt`,
    audit `auth.login.success`.

Error mapping: `invalid` → `401 Invalid credentials`; `blocked` → `403 <specific reason>`.

### 3.2 Wrong password / failed-attempt handling

Layers, from outermost in:

| Layer | Control | Where |
|---|---|---|
| Browser | 5 submits/60s + 5-failure/15-min lockout in `localStorage` | `apps/admin/src/lib/login-guard.ts` |
| Network | Per-IP throttle 20/60s on `/auth/login` (in-memory) | `@Throttle` in `auth.controller.ts` |
| Account | 5 failures in 15 min since last success → 403 lockout | `AuthService.isLockedOut` |
| Audit | `auth.login.failed`, `auth.login.locked`, `auth.login.blocked` rows with IP + user agent | `AuthService.audit` |

The lockout counter is derived from the committed `AuditLog` table (no separate counter state); a
successful login naturally resets the window because the count starts at `lastLoginAt`.

### 3.3 Change password — `POST /auth/password/change`

Authenticated. Decorated `@AllowDuringPasswordChange()` and `@AllowInReadOnly()` so it works on a
temp-password session and on a read-only (past-due) subscription.

1. If `confirmPassword` is supplied it must equal `newPassword`.
2. `assertStrong(newPassword)` — min 8 chars, upper, lower, digit, special.
3. `assertNotBreached(newPassword)` — HIBP k-anonymity range API, **only when
   `PASSWORD_BREACH_CHECK=1`**, 2.5s timeout, **fail-open**.
4. Verify `currentPassword` against the stored hash → else `401 Current password is incorrect`.
5. Reject a new password equal to the current one (`400`). No history beyond N=1.
6. Write the new scrypt hash; clear `mustChangePassword`; set `passwordUpdatedAt` /
   `lastPasswordChangeAt`; null out `passwordResetIssuedAt` / `passwordResetExpiresAt`.
7. Revoke **all** the user's non-revoked refresh tokens.
8. Audit `auth.password.change` (+ `reset.completed` when this closed out a reset).

Client (`change-password/page.tsx`) shows a live policy checklist mirroring the backend rules, then
clears the cached principal and redirects to `/login` after 1.5s.

### 3.4 Forgot password — `POST /auth/password/reset/request`

Design choice: **this is a temporary-password flow, not a reset-link flow.**

1. Normalise the email (trim + lowercase) as the audit/rate-limit key.
2. Always write a `PasswordResetAudit` row with action `reset.request` — even for unknown emails.
3. Per-email rate limit read back from that audit trail: more than `RESET_EMAIL_MAX = 3` requests in
   a 15-minute window → return silently (no signal to the caller).
4. Resolve the user. Unknown → return silently.
5. Generate a 14-character temporary password from a CSPRNG
   (`crypto.getRandomValues`), guaranteed to contain upper/lower/digit/special, Fisher–Yates
   shuffled, drawn from an unambiguous alphabet (no `I`, `l`, `O`, `0`, `1`).
6. Store only its scrypt hash. Set `mustChangePassword = true`,
   `passwordResetIssuedAt = now`, `passwordResetExpiresAt = now + 24h`. This **overwrites the
   existing password**, which is what invalidates the old one and any earlier temp password.
7. Revoke all live refresh tokens.
8. Email the temporary password via Resend from the admin sender; HTML is escaped; the password is
   never logged. Audit `auth.password.reset.request`, `auth.password.reset.email`,
   `reset.email_sent`.

The controller always responds `202` and the UI always shows the same neutral confirmation.

**Temporary-password lifecycle** — a temp password is rejected at login once `passwordResetExpiresAt`
has passed; a correct-but-expired attempt is audited as `reset.expired_attempt` and returns 403 with
"Your temporary password has expired. Please request a new one."

`MustChangePasswordGuard` then blocks *every* protected route (403,
`code: PASSWORD_CHANGE_REQUIRED`) while the access token carries the `mcp` claim, except
`@AllowDuringPasswordChange()` routes (`/auth/password/change`, `/auth/me`) and `@Public()` routes.
The admin `Shell` mirrors this client-side by redirecting to `/change-password`.

### 3.5 Admin-initiated reset — `POST /users/:id/reset-password`

Same temp-password mechanics (24h window, sessions revoked, `user.password.reset` audit), but the
generated temporary password is **returned in the HTTP response body** so the admin can read it out,
and emailed best-effort when mail is configured.

### 3.6 Session issuance, refresh, logout

- **Access token**: HS256 JWT, `JWT_ACCESS_TTL` default **900s**. Claims:
  `sub`, `tid`, `plat`, `roles[]`, `perms[]`, and `mcp: true` while a password change is pending.
- **Refresh token**: opaque, `randomBytes(48).toString('base64url')` (384 bits). Only its SHA-256
  hash is stored (`RefreshToken.tokenHash`, unique). TTL `JWT_REFRESH_TTL` default **30 days**.
  Rows carry `familyId`, `expiresAt`, `revokedAt`, `replacedByTokenId`, `ip`, `userAgent`.
- **Rotation & reuse detection**: refresh rotates within the family and revokes the presented row.
  Presenting an already-revoked token revokes the **entire family** and audits `auth.refresh.reuse`.
- **Logout**: revokes the whole family and clears cookies.
- **Cookies** (`cookies.ts`): `munaxa_at` and `munaxa_rt` are `httpOnly`, `sameSite=Strict`,
  `path=/`, `secure` only when `NODE_ENV === 'production'`. `munaxa_csrf` is a 256-bit random,
  **readable** companion for the double-submit check, same flags minus `httpOnly`.
- **CSRF** (`CsrfGuard`): skipped for `@Public()` routes, for safe methods, and for requests with no
  `munaxa_at` cookie (Bearer clients). Otherwise requires `X-CSRF-Token === munaxa_csrf`, compared
  with `!==`.
- **Client idle timeout**: 15 minutes of no interaction → `logout()` (client-side only,
  `apps/admin/src/components/shell.tsx`).

---

## 4. Controls already in place (do not re-flag as missing)

- scrypt (N=2^15, r=8, p=1, 32-byte key, 16-byte salt), self-describing hash format, constant-time
  compare via `timingSafeEqual`, transparent bcrypt→scrypt upgrade on login.
- Opaque, hashed-at-rest refresh tokens with rotation, family revocation and reuse detection.
- Full session revocation on password change, on reset issuance, and on suspend/disable.
- httpOnly + SameSite=Strict session cookies; tokens unreadable by JS; double-submit CSRF on top.
- Per-IP throttling per endpoint, per-account lockout, per-email reset throttle, plus a client-side
  deterrent.
- Anti-enumeration `202` on the reset endpoint; generic `401 Invalid credentials` on login.
- Two audit trails (`AuditLog` and a dedicated `PasswordResetAudit`) with IP and user agent, written
  inside the transaction so failure records commit.
- Server-authoritative input sanitisation and validation (control-char stripping, length caps,
  tenant-slug shape validation, `whitelist`/`forbidNonWhitelisted`).
- HIBP breach checking available (k-anonymity, prefix-only).
- Secrets: `JWT_ACCESS_SECRET` is mandatory in production (`NODE_ENV === 'production'`); the demo
  app fails closed in production without `DEMO_SESSION_SECRET`.
- Temporary passwords: CSPRNG, 14 chars, hashed at rest, 24h expiry, never logged, HTML-escaped in
  the email.

---

## 5. Findings and open questions for the reviewer

Severities are the authors' first pass — please challenge them. Nothing below has been fixed.

### F-1 — `POST /auth/password/reset/confirm` appears to be dead code (High, correctness)

`AuthService.confirmPasswordReset` looks up `PasswordResetToken` rows, but **no code path anywhere in
the repository creates one** (the model is referenced only in `auth.service.ts`). The live forgot-
password flow issues a temporary password instead. So the endpoint is permanently unreachable-but-
exposed: it validates and hashes an attacker-supplied `newPassword` before the token lookup, and it
is the only reset path that does *not* revoke the temp-password window fields. Please confirm whether
it should be removed or wired up, and whether an unreachable public endpoint that performs scrypt
hashing before rejecting is a usable CPU-exhaustion primitive at 10 req/min/IP.

### F-2 — No MFA anywhere (High)

There is no TOTP/WebAuthn/SMS second factor for any role, including platform-level (`isPlatform`)
accounts that can cross tenant boundaries, and no step-up on sensitive actions. Password + email
recovery is the entire authentication strength.

### F-3 — Unauthenticated password invalidation / account DoS (High)

`requestPasswordReset` overwrites the victim's `passwordHash` **before** email delivery is confirmed,
and `MailService.send` reports `{ sent: false }` silently on failure or when `RESEND_API_KEY` is
unset. Anyone who knows a user's email can therefore invalidate that user's password at will
(3–4 requests per 15-minute window, repeatable indefinitely, from rotating IPs). If mail is
misconfigured or the address is stale, the victim is locked out with no self-service path. A
reset-link/token flow that leaves the old password valid until the link is used avoids this. Please
assess exploitability and whether the anti-enumeration benefit justifies it.

### F-4 — Firebase session exchange links identities on unverified email (High)

`exchangeFirebaseSession` looks up a Munaxa user by `identity.email` and, on a match, permanently
binds `firebaseUid` to that account. It does **not** check `email_verified` on the decoded token. If
any enabled Firebase provider can mint a token carrying an attacker-chosen, unverified email, this is
a direct account takeover of the matching Munaxa account. This path also skips the account lockout,
the temporary-password expiry check, and failure auditing that local login performs. Please confirm
which Firebase providers are enabled in production and whether this path is reachable.

### F-5 — Insecure JWT secret fallback outside `NODE_ENV=production` (High)

`TokenService` throws only when `NODE_ENV === 'production'`. On any other value — `staging`,
`preview`, an unset variable in a container — it logs a warning and signs with the hard-coded
`'dev-only-insecure-access-secret'`. Anyone reading this repository can then forge an access token
with arbitrary `tid`, `roles`, `perms` and `plat: true`. The same `NODE_ENV` condition also drives the
cookie `secure` flag in `cookies.ts`, so a non-production deploy serves session cookies over plain
HTTP. Please assess as a deployment-configuration risk.

### F-6 — Account lockout is a DoS primitive and a user-enumeration oracle (Medium)

`isLockedOut` locks the account, not the IP: five wrong guesses from anywhere lock a known user out
for up to 15 minutes, repeatable indefinitely — targeted denial of service against, say, a school
principal on results day. It also leaks existence: five bad guesses against a real account return
`401 ×5` then `403 "Too many failed attempts"`, whereas a non-existent account returns `401` forever.
Consider whether IP-scoped/progressive delays would be a better trade-off.

### F-7 — Login timing and error messages leak account existence (Medium)

Three separate oracles:
1. **Timing** — an unknown handle returns before any hashing; a known handle pays a full scrypt
   verification (N=2^15, tens of milliseconds). No dummy-hash comparison is performed.
2. **`400` disambiguation errors** — `resolveUserByEmail` / `resolveUserByIdentifier` throw
   *"Multiple accounts found for this email; specify the school."* and *"This handle is used at more
   than one school"*, which confirm existence and reveal multi-tenant presence, pre-authentication.
3. **Post-auth `403` texts** — "Account is disabled" / "Account is suspended" are only reached after
   a correct password, so these are lower risk, but they are still distinguishable.

The reset endpoint's anti-enumeration `202` is undermined by the same timing asymmetry (unknown email
returns immediately; known email performs a scrypt hash, several writes and an outbound HTTP call).

### F-8 — Change-password endpoint bypasses the account lockout (Medium)

`isLockedOut` only counts `auth.login.failed` rows. A wrong `currentPassword` on
`/auth/password/change` is **not audited at all** and does not feed any counter, so an attacker
holding a stolen access token (or an unattended session) can guess the current password at 10/min per
IP indefinitely, invisibly to both the lockout and the audit trail. Failed reset-confirm attempts are
likewise unaudited. Recommend confirming whether this is a real gap in the detection story.

### F-9 — Access tokens survive credential and privilege changes for up to 15 minutes (Medium)

Access tokens are stateless with no `jti`, no denylist and no server-side session check.
`changePassword`, `requestPasswordReset` and suspend/disable all revoke *refresh* tokens only, so an
already-issued access token remains valid for the remainder of its TTL. Concretely: after a forced
reset, a session that already holds an access token minted **without** the `mcp` claim continues to
pass `MustChangePasswordGuard` and can keep using the application for up to 15 minutes. Role and
permission changes have the same staleness window because `roles`/`perms` are baked into the token.

### F-10 — Password policy is below current baselines (Medium)

Minimum length **8** with a composition rule (upper + lower + digit + special) is weaker than the
NIST SP 800-63B / OWASP ASVS guidance of ≥12 (or ≥8 *with* a breach check always on). The breach
check that would compensate is **off by default** (`PASSWORD_BREACH_CHECK !== '1'`) and **fails open**
on any network error or non-200 response. There is no password history beyond "must differ from the
current one", no per-tenant policy, and no maximum password age. Please advise on the right target
for a school SaaS holding minor-student data.

### F-11 — Rate limiting is in-memory and IP-derived (Medium)

`ThrottlerModule` uses the default in-memory store, so on a multi-instance deployment (Render
autoscaling) every effective limit is multiplied by the instance count and is lost on restart/deploy.
`trust proxy = 1` means the client IP is taken from `X-Forwarded-For`; if the API container is
reachable other than through the intended proxy, that header is attacker-controlled and all per-IP
limits — including the login throttle — are trivially bypassed. Throttling is also disabled outright
under `NODE_ENV=test`.

### F-12 — CSRF gaps on public auth routes (Low–Medium)

`CsrfGuard` returns `true` for every `@Public()` route, which includes `POST /auth/login`,
`/auth/refresh` and `/auth/logout`. That permits classic login-CSRF (forcing a victim's browser into
an attacker-controlled session) and cross-site forced logout / forced refresh-rotation. `SameSite=Strict`
on the cookies is the actual mitigation today, so the double-submit layer is not defence-in-depth for
these three routes. Secondary points: the CSRF token is compared with `!==` rather than a
constant-time comparison; it is not bound to the user or session and is never rotated; cookies use no
`__Host-` prefix and no explicit `domain`.

### F-13 — Temporary password delivered in the email body (Low–Medium)

The forgot-password flow mails a live credential rather than a single-use link. It persists in the
mailbox, in any mail archive/DLP system, and in Resend's logs for its retention period, and it is
valid for 24 hours against the login endpoint. The admin-initiated reset additionally returns the
temporary password in an HTTP response body, where it can land in proxy logs, browser history or
screen recordings. Please weigh against the operational reality that school staff often share
devices.

### F-14 — Audit and reset-audit tables are unbounded and hold unauthenticated input (Low)

`PasswordResetAudit` records the raw submitted email for **every** request including unknown
addresses, with IP and user agent, and there is no retention or purge job. Same for `AuditLog`
`auth.login.failed` rows, whose `metadata.identifier` stores whatever handle was submitted. This is
both a growth concern and a GDPR/consent question for a product marketed as "GDPR Ready" that
processes minors' data. No expired-`RefreshToken` cleanup job was found either.

### F-15 — scrypt parameters are read from the stored hash without bounds (Low)

`PasswordService.verify` parses `N`, `r`, `p` from the stored string and passes them straight to
`scrypt` with `maxmem = 128 * n * r * 2`. Only `Number.isFinite` is checked — no upper bound. Any
write primitive into `User.passwordHash` becomes a memory/CPU exhaustion primitive at verification
time. Low exploitability (requires DB write), noted for completeness.

### F-16 — Client-side auth state (Low, informational)

`login-guard.ts` state lives in `localStorage` and is trivially cleared; the code documents this and
the server-side controls are authoritative, so this is correct as designed. Flagged only so the
reviewer does not mistake it for a control. Likewise, the 15-minute idle timeout is client-side only
— there is no server-side absolute or idle session cap short of the 30-day refresh TTL, and "remember
me" persists the identifier and school code in `localStorage`.

---

## 6. Specific questions for the reviewer

1. Is the temporary-password reset design (F-3) defensible for this product, or should it be replaced
   with a single-use reset link that leaves the existing password valid until redemption?
2. Is the account-lockout DoS (F-6) an acceptable trade for brute-force resistance in a school
   context, or is per-IP/progressive backoff the better default?
3. How should the 15-minute stateless access-token window (F-9) be closed — short-lived tokens plus a
   revocation list, a `tokenVersion`/`sessionId` claim checked per request, or opaque sessions?
4. What is the right password baseline (F-10) for a SaaS holding minors' PII under Jordanian law plus
   the GDPR posture the product advertises — and should the HIBP check be mandatory and fail-closed?
5. Is the Firebase linking path (F-4) exploitable given the providers actually enabled, and what is
   the minimal fix beyond requiring `email_verified`?
6. Which findings block a production launch versus which belong on a hardening backlog?
7. Are there flows we have not modelled — password change while an admin-initiated reset is in
   flight, concurrent refresh from two devices, reset requested during an active lockout, tenant slug
   omitted for a handle that exists in several tenants?

---

## 7. Configuration relevant to the review

| Variable | Default | Effect |
|---|---|---|
| `JWT_ACCESS_SECRET` | none | Required in production; insecure hard-coded fallback otherwise (F-5) |
| `JWT_ACCESS_TTL` | `900` (15 min) | Access-token lifetime, drives the revocation lag (F-9) |
| `JWT_REFRESH_TTL` | `2592000` (30 d) | Refresh-token lifetime / max session age |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | `60` / `120` | Global per-IP throttle; per-route overrides in the controller |
| `PASSWORD_BREACH_CHECK` | unset (off) | `1` enables the HIBP check; fails open regardless (F-10) |
| `RESEND_API_KEY` | unset | Unset ⇒ mail is a silent no-op, which matters for F-3 |
| `EMAIL_FROM`, `EMAIL_FROM_ADMIN` | — | Sender for the temp-password email |
| `CORS_ORIGINS` | `http://localhost:3000` | Allow-list, `credentials: true` |
| `FIREBASE_PROJECT_ID` / `_CLIENT_EMAIL` / `_PRIVATE_KEY` | unset | All three unset ⇒ `/auth/session` rejects (F-4 unreachable) |
| `NODE_ENV` | — | Gates the JWT secret check, cookie `Secure`, Swagger exposure, throttling |
| `NEXT_PUBLIC_APP_HOST` / `NEXT_PUBLIC_CONSOLE_HOST` | unset | Host separation of portal vs console; fails open when unset |

Note: Swagger (`/api/docs`) is served whenever `NODE_ENV !== 'production'` — the same condition
family as F-5.

---

## 8. Test coverage that exists today

`auth.dto.spec.ts`, `password.service.spec.ts`, `token.service.spec.ts`,
`must-change-password.guard.spec.ts`, `permissions.guard.spec.ts`, `tenant-isolation.guard.spec.ts`.
There is an e2e suite that asserts rate limiting explicitly (which is why throttling is disabled for
`NODE_ENV=test` elsewhere). No dedicated tests were found for the lockout window, refresh reuse
detection, or the forgot-password rate limit — worth confirming as part of the review.

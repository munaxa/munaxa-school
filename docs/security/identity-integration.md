# Munaxa Identity integration (SC-07)

**Status:** API side implemented on `claude/project-thread-4sspd9`. Frontends, Identity-side
provisioning and the deployment steps below are still to do.
**Reference:** munaxa-work. This follows its Identity integration (Work ADR-0001, ADR-0076, ADR-0080).
Where School does something differently, this document says so.

## The finding

School authenticated people itself. It checked passwords, exchanged Firebase ID tokens and signed
its own HS256 access tokens with `JWT_ACCESS_SECRET`. It never checked tokens issued by Munaxa
Identity, so one person had a separate School login, and signing out of Identity, or having a
session revoked there, did not end their School session. Work and Control already verify Identity
tokens.

## How School authenticated before this change

| Piece | File | What it does |
| --- | --- | --- |
| Global guard | `apps/api/src/auth/guards/jwt-auth.guard.ts` | Takes the token from the `Authorization: Bearer` header, or from the `munaxa_at` httpOnly cookie, and verifies it as HS256 against `JWT_ACCESS_SECRET` |
| Token issue and verify | `apps/api/src/auth/services/token.service.ts` | Signs `{sub, tid, plat, roles, perms, mcp}` with HS256, 900 s TTL. Refresh tokens are 48 random bytes; only the SHA-256 is stored (`RefreshToken`) |
| Sign-in | `apps/api/src/auth/services/auth.service.ts`, `auth.controller.ts` | `POST /auth/login` (email, username or National ID plus password, with lockout), `POST /auth/session` (Firebase exchange), `refresh` (rotation with reuse detection), `logout`, password reset and change, `me` |
| Firebase | `apps/api/src/auth/services/firebase.service.ts` | Optional `firebase-admin` ID-token check. It links an existing account by a verified email, or by `User.firebaseUid` (globally unique) |
| Authorization | `rbac.service.ts`, `permissions.guard.ts` | Roles and permissions come from School's own tables (`Role`, `RolePermission`, `UserRole`, per-tenant custom roles). The guard checks the `perms` claim |
| Tenancy | `tenant-context.interceptor.ts`, `prisma/tenant.helpers.ts` | The principal's `tenantId` goes into `TenantContextStore`. `withTenant` sets `app.tenant_id` and `withPlatform` sets `app.is_platform`. PostgreSQL RLS (`app_current_tenant() OR app_is_platform()`) is forced on every tenant table |
| Other guards | `must-change-password`, `csrf` (cookie sessions only), `tenant-isolation`, plan and read-only guards | Unchanged |
| User model | `User` (one row per tenant; email, username and nationalId are unique per tenant) | A person who belongs to two schools has two rows (ADR 15) |
| Clients | `apps/admin/src/lib/auth.ts` (cookie session via `/auth/login` and `/auth/refresh`), `apps/mobile/lib/data/auth/auth_api.dart` (Bearer via `/auth/login` and `/auth/refresh`; Firebase for push only) | `munaxademo` has its own database-free demo login and does not call the API |

## What changed

```
Authorization: Bearer <token>
        │
        ├─ header alg = ES256 and PLATFORM_AUTH_* configured ─► IdentityAuthenticationService
        │     1. verify (node:crypto): alg ES256 only, kid → configured public key, P-256 signature,
        │        exp (+skew), iat/nbf not in the future, iss exact, aud overlap
        │     2. resolve: (iss, tid) → TenantPlatformBinding → school; sub → User.platformSubject in
        │        that school (not deleted, disabled or suspended). No binding or no account → 401
        │     3. introspect: GET {issuer}/api/auth/introspect. Positive answers are cached ≤ 5 s;
        │        if Identity cannot answer → 401
        │     4. permissions = token `perms` filtered to `school:<permission>`; never platform-plane
        │     5. an archived school → 403 (same rule as local sign-in)
        │
        └─ otherwise, only if SCHOOL_LOCAL_AUTH allows ─► School's own HS256 token (header or cookie)
```

An Identity token is never tried as a School token, and a School token is never tried as an
Identity token. Each path accepts only its own algorithm.

### Verification without `@munaxa/auth`

Work verifies with `@munaxa/auth`'s `TokenService` and `@munaxa/crypto`'s `AsymmetricSigner`.
School's lockfile does not contain `@munaxa/auth`. Adding it needs a lockfile resolved against
GitHub Packages, and this change was written without access to that registry. So
`auth/identity/access-token.verifier.ts` runs the same checks with `node:crypto`, one rule at a
time:

- The algorithm comes from configuration, not from the token header.
- The header's `kid` selects the key.
- The ES256 signature is in IEEE P1363 form.
- `exp` is required and must be finite. With the skew, a token is expired when
  `exp*1000 + skew < now`.
- `iat` must not be later than `now + skew`. School also applies the same rule to `nbf`.
- `iss` must equal the configured issuer exactly.
- `aud` is read as a list, and at least one entry must match. A string is not matched as a
  substring.

School is stricter than Work in one place: the header's `alg` must also be `ES256`.

`session-status.ts` is Work's `session-revocation.ts`, ported. Its spec is Work's own spec,
running under Jest. Moving to `@munaxa/auth` later only changes how the verifier is built.

### Data model (migration `20261121120000_identity_platform_binding`)

- `TenantPlatformBinding(tenantId unique, platformIssuer, platformTenantId, createdAt, createdBy, deletedAt)`,
  with `(platformIssuer, platformTenantId)` unique: one organisation per school and one school per
  organisation. RLS uses the same `tenant_isolation` policy as other tenant tables. The runtime role
  `munaxa_app` can only `SELECT` the table. The migration, `app-role.sql` and `runtime-grants.sql`
  all revoke its write access.
- `User.platformSubject`: the Identity `sub`, unique per tenant. This mirrors Work's
  `workforce_user.platform_user_id` without changing School's one-row-per-tenant user model. A
  person in two schools has one Identity account linked in both, and each organisation's token
  reaches only its own school.
- The token is resolved with `withPlatform`, the same way local login looks up an account before
  any tenant is in context. After that, every request runs in the resolved tenant's RLS context, as
  before.

### Switches

| Variable | Meaning |
| --- | --- |
| `PLATFORM_AUTH_ISSUER`, `_AUDIENCE`, `_ALGORITHM` (`ES256`), `_PUBLIC_KEYS` | All four or none. A partial or invalid set stops boot in every environment |
| `PLATFORM_AUTH_REVOCATION_CHECK` | `introspect` (default). `disabled` is refused in production |
| `PLATFORM_AUTH_INTROSPECTION_URL`, `_REVOCATION_CACHE_MS` (≤ 30000, default 5000), `_INTROSPECTION_TIMEOUT_MS`, `_CLOCK_SKEW_MS` (default 30000) | Work's defaults and limits |
| `SCHOOL_LOCAL_AUTH` | `enabled` or `disabled`. **When unset it is enabled outside production and disabled in production.** Production must have Identity configured or `SCHOOL_LOCAL_AUTH=enabled`, otherwise boot stops. `JWT_*` secrets are required only while local sign-in is on. With local sign-in off, `/auth/login`, `/session`, `/refresh`, `/logout` and `/password/*` answer 404, and no School token verifies |

**Breaking for existing production deployments.** Render and AWS run with `NODE_ENV=production`
and have no Identity configuration yet. They must set `SCHOOL_LOCAL_AUTH=enabled`, or the Identity
variables, before deploying this commit. Otherwise the API will not start. On Render the previous
deploy stays live.

### Provisioning a school (owner role only)

```bash
DIRECT_DATABASE_URL=<owner> pnpm --filter @school/api identity:bind -- \
  --tenant-slug <school> --platform-tenant-id <Identity organisation id> \
  --platform-issuer <PLATFORM_AUTH_ISSUER> \
  [--link-email <existing School account email> --platform-user-id <Identity sub>] [--allow-production]
```

The script is idempotent and never changes an existing binding or link. It writes `AuditLog` rows.
It creates no Identity accounts, roles or grants.

## Identity side (munaxa-identity; not changed here)

1. **Audience.** Add `munaxa-school` to `IDENTITY_AUTH_AUDIENCE`, for example
   `munaxa-work,munaxa-control,munaxa-school`. Identity's runbook already flags that one shared
   audience list means a token for one product is accepted by every listed product's audience
   check. School limits the effect of this the way Work does: the token's organisation must be
   bound to the school, and only `school:` grants count.
2. **Catalogue artifact.** Run `pnpm --filter @school/api identity:catalogue`. It emits the 120
   `school:` grants School honours: 139 permissions minus 18 `platform:*` and
   `support:impersonate`. Copy the output into `artifacts/school-permissions.json`, as Identity
   already does with `work-permissions.json`. School drops any grant it does not declare, so a
   stale copy results in a denial, never an escalation.
3. **Role seed, proposed `apps/api/scripts/seed-school-roles.mjs`.** Copy `seed-work-roles.mjs`:
   read the catalogue, expand groups, and refuse wildcards, scopes and undeclared grants. Run it per
   organisation as the Identity owner, then restart Identity, because its role cache is
   per-process. Proposed roles, one per School system role, generated from School's
   `DEFAULT_ROLE_PERMISSIONS` so the two stay aligned:

   | Identity role key | Grants |
   | --- | --- |
   | `school-admin` | every `school:` grant (SchoolAdmin) |
   | `school-principal`, `school-vice-principal` | Principal / VicePrincipal sets |
   | `school-finance-officer`, `school-accountant` | finance sets |
   | `school-teacher` | Teacher set |
   | `school-registrar`, `school-secretary`, `school-receptionist`, `school-counselor`, `school-hr`, `school-nurse`, `school-librarian`, `school-storekeeper`, `school-fleet-admin`, `school-bus-supervisor` | the matching sets |
   | `school-parent`, `school-student` | Parent / Student sets (only if parents and students sign in through Identity; see the open decisions) |

   The simplest generator is a School-emitted `school-roles.json`
   (`{ key, name, grants[] }[]` from `permissionsForRole`), which Identity's seed script reads the
   same way it reads the catalogue. Staging starts with `school-admin` and `school-teacher`.
4. **Accounts.** `db:bootstrap-account --role school-admin` in the school's organisation, then
   `identity:bind --link-email … --platform-user-id <sub>` on the School side.

## Licensing (Control Plane)

School already uses Munaxa Control for licensing in the same way as Work. No new code is needed.

- `apps/api/src/subscription/licence.source.ts` has the same structure as Work's
  `apps/api/src/licensing/licence.source.ts`. Both use `@munaxa/licensing`: `entitlementsPath`,
  `readEntitlementResponse`, `resolveSnapshot` with `SAAS_AVAILABILITY_POLICY`, and `usagePath`.
- `LICENSING_MODE=CONTROL_PLANE` with `CONTROL_PLANE_URL` (https in production) and the
  `CONTROL_PLANE_TOKEN` service credential.
- Each tenant is asked `GET /api/v1/products/school/tenants/{tenantId}/entitlements` with a 3 s
  timeout and no redirects, and the answer is cached for 60 s. The last answer is kept in
  `LicensingState`. Usage is reported to `POST /api/v1/products/school/usage`.
- Production refuses `DATABASE` mode (school#18). Control lists `school` in `PRODUCTS`.

What the Identity integration adds:

1. **Same tenant key in both places.** Control's `tenantRef` for the `school` product is the School
   tenant UUID, which is the `tenantId` that `TenantPlatformBinding` binds. Provisioning order:
   create the School tenant, link it in Control as `school` / `tenantRef = <School tenant id>`, then
   bind it to the Identity organisation. This matches Work's `deploy/aws/README.md`.
2. **Unchanged sign-in rule.** `SubscriptionService.signInRefusal` (archived school) applies to
   Identity principals on every request. A local session hits it only at login and refresh.
3. **Not built:** a stored link from a Control customer to an Identity organisation. Work does not
   have one either. Keep the three ids (Control customer, School tenant, Identity organisation)
   side by side in the provisioning record until Control models it.

## CI must prove

- `pnpm install --frozen-lockfile` with `PLATFORM_PACKAGES_TOKEN`. No dependency was added, and the
  lockfile is unchanged.
- `prisma migrate deploy` applies `20261121120000_identity_platform_binding` on a clean database,
  then `app-role.sql`, then the seed.
- `pnpm lint`, `typecheck`, `test` (new specs: verifier, config, grants, session status, guard,
  local switch, env).
- `test:e2e`, including `test/identity-auth.e2e-spec.ts`: binding-based resolution, isolation
  between organisations and schools under RLS, token permissions, revocation through a live
  introspection endpoint, HS256/public-key confusion, and that the runtime role cannot write a
  binding.
- `pnpm build`, the image builds (the new migration is included in the `migrate` image), and the
  `security` job.

## Open product decisions

- **Where School permissions live for Identity users.** This change follows Work: permissions come
  from Identity roles (`school:` grants). For Identity users, School's role editor and custom roles
  stop having any effect. The alternative is that Identity only authenticates and School keeps its
  own RBAC.
- **Parents and students.** Do they get Identity accounts (mass provisioning, mobile sign-in
  through Identity), or do they stay on School's own sign-in, which then can never be turned off?
- **Platform console.** Identity principals never receive School's platform plane. Decide whether
  staff move to Control or keep School's own sign-in through a separate deployment or flag.
- **Admin web sign-in.** The admin uses School's cookie session. It needs an Identity sign-in flow,
  either a BFF that holds the Identity token or Identity's hosted sign-in, before
  `SCHOOL_LOCAL_AUTH` can be turned off.
- **Linking existing accounts.** Use the owner script per account, add an admin UI to link a School
  account to an Identity subject, or link automatically when a verified email claim matches.
  Identity tokens currently carry no email.
- **Audience per client.** Identity issues one audience list to every client. Per-client audiences
  would be tighter, but that is a change in Identity.
- **Retiring Firebase sign-in** (`/auth/session`). Firebase is still used for push notifications.

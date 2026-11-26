# Sign in with Munaxa Identity

School signs its **staff** in through **Munaxa Identity** (munaxa-identity ADR-0008): one Munaxa
sign-in, with Identity's MFA, lockout, session revocation and Microsoft or Google company sign-in.
Since 26 Nov 2026 (owner decision) staff have no School password sign-in in production; parents
and students keep theirs (see "Staff passwords" below).

## How it works

1. The sign-in page shows **Sign in with Munaxa** when `IDENTITY_SIGN_IN=enabled`
   (`GET /api/v1/auth/identity/enabled`). The person enters the school code and presses it.
2. `GET /api/v1/auth/identity/start?school=<code>` looks up that school's Identity client, sets a
   short-lived binding cookie (state, nonce, PKCE verifier; `httpOnly`, `SameSite=Lax`,
   `__Host-` in production) and redirects to Identity's authorize endpoint.
3. Identity signs the person in (or reuses their session) and returns to
   `GET /api/v1/auth/identity/callback` with a code. Only the browser that started the flow is
   accepted (state must match the cookie; the cookie is spent either way).
4. School redeems the code at Identity's token endpoint with the client secret and the PKCE
   verifier, then verifies the id token: ES256 under `IDENTITY_PUBLIC_KEYS`, issuer, audience,
   expiry, nonce, the organisation the client is bound to, and a verified email.
5. School signs in the **existing, active** School user of that school with that email. Nobody is
   created, and roles and permissions stay School's own. Identity's subject is stored on first
   use (`User.identitySubject`); from then on only that Identity account signs in as this user.
6. The ordinary School session cookies are set and the browser continues to the portal.

### Administrators need two-step verification

Users holding a platform role, `SchoolAdmin`, `Principal`, `VicePrincipal`, `FinanceOfficer`,
`Accountant` or `HR` sign in through Identity only when Identity says the sign-in used a second
factor (`acr: "mfa"` in the id token). This is checked when the account is first linked by its
checked email and again at every sign-in, so a person promoted after linking is covered too.
Without it the page says `?identity=mfa-required` and nothing is linked.

Identity only marks an address verified when it was shown to belong to the person (company
directory, a used recovery link, or an operator's recorded confirmation; munaxa-identity#34), and
School refuses an id token whose `email_verified` is not `true`.

### Staff passwords

`STAFF_PASSWORD_SIGN_IN` decides whether staff may still use a School password, on the web
sign-in page (`POST /auth/login`) and in the mobile apps (`POST /auth/login`, `POST /auth/session`):

| Value | Who may sign in without Munaxa |
| --- | --- |
| `disabled` (production default) | Parents and students only (users whose every role is `Parent` or `Student`) |
| `emergency` | As `disabled`, plus `SchoolAdmin` and platform roles; each such sign-in is audited as `auth.login.emergency` |
| `enabled` (default outside production) | Everyone |

The check runs only after the password is proved, so it reveals nothing to someone without it; a
refused staff sign-in answers `403 Staff sign in with Munaxa` and is audited as
`auth.login.password_disabled`. The API refuses to start with `disabled` or `emergency` unless
`IDENTITY_SIGN_IN=enabled`, so staff are never left with no way in. The web sign-in page reads the
setting from `GET /api/v1/auth/identity/enabled` and shows only **Sign in with Munaxa**
(`disabled`), or tucks the password form under "Emergency sign-in" (`emergency`).

`emergency` is for an Identity outage: switch it on, sign in, switch it off. School has no second
factor of its own, so an emergency sign-in is password only: keep it off, alert on every
`auth.login.emergency` audit event, and revoke the sessions it opened once Identity is back.

Outcomes the sign-in page explains: `?identity=unavailable` (school not configured),
`failed` (cancelled, expired, or any protocol check failed), `no-account` (no School user with
that email, or already linked to another Identity account), `blocked` (account disabled,
suspended, or the school's subscription refuses sign-in), `mfa-required` (an administrator
without two-step verification). The exact reason is in the API log and
the audit trail (`auth.identity.*`), never in the address bar.

## The teacher app

The teacher app signs staff in the same way, in the **system browser** (iOS
`ASWebAuthenticationSession`, Android Custom Tabs; never a web view, RFC 8252):

1. The app makes a PKCE verifier and opens
   `GET /api/v1/auth/identity/start?school=<code>&app=<S256 challenge>`.
2. The ordinary flow above runs in the browser. At the callback School sets **no** web cookies: it
   sends the browser to `IDENTITY_APP_REDIRECT_URI` with `?handoff=<sealed>` (or `?error=<outcome>`,
   the same outcomes as the web page).
3. The app redeems it: `POST /api/v1/auth/identity/app-session {handoff, verifier}` returns the
   ordinary mobile token pair.

The hand-off is the new session's refresh token sealed (AES-256-GCM, key derived from
`JWT_REFRESH_SECRET`) with the app's challenge and a two-minute expiry. It is useless without the
verifier, and redeeming rotates the refresh token, so a second redemption is refresh-token reuse
and ends that session. Administrators still need Identity's two-step verification.

**Return address.** Production accepts only an https link that the operating system has verified
belongs to the app (Android App Links, iOS universal links, iOS 17.4+), because any app can claim a
custom scheme. Outside production a reverse-domain scheme is accepted, the app's default
`com.munaxa.teacher://signed-in` (`--dart-define=MUNAXA_SIGN_IN_RETURN=…` changes it). The app's
platform folders are generated at build time, so the release build adds the
`flutter_web_auth_2` callback activity (Android) and, for https, the associated domain and the
`assetlinks.json` / `apple-app-site-association` files on the School host. Until then the app
signs in through Munaxa on a development build only.

## Configuration

| Variable | Value |
| --- | --- |
| `IDENTITY_SIGN_IN` | `enabled` or `disabled` (default) |
| `IDENTITY_ISSUER` | Identity's issuer (its `MUNAXA_TOKEN_ISSUER`), https in production |
| `IDENTITY_SIGN_IN_REDIRECT_URI` | `https://<school host>/api/v1/auth/identity/callback` |
| `IDENTITY_SIGN_IN_CLIENTS` | `school-slug\|client-id\|identity-organisation`, `;` between schools |
| `IDENTITY_SIGN_IN_CLIENT_SECRETS` | `client-id=<secret>`, `,` between. A secret: from the secret store only |
| `IDENTITY_PUBLIC_KEYS` | Identity's public signing keys, the same JSON Work reads |
| `IDENTITY_APP_REDIRECT_URI` | Optional: where the teacher app's sign-in returns (above). Needs `JWT_REFRESH_SECRET` |
| `STAFF_PASSWORD_SIGN_IN` | `disabled`, `emergency` or `enabled`; unset: `disabled` in production, `enabled` elsewhere |

The API refuses to start when the switch is on and any of these is missing or malformed, when a
client has no secret, or when a client secret equals another secret School holds.

## Pairing a school with Identity

1. In Identity, add a client for the school: `IDENTITY_OIDC_CLIENTS` gets
   `school-<slug>|<identity organisation>|https://<school host>/api/v1/auth/identity/callback`
   (Terraform `identity_oidc_clients`), and its secret goes into Identity's secret bundle.
2. The same secret goes into School's secret bundle as `IDENTITY_SIGN_IN_CLIENT_SECRETS`.
3. Add `<slug>|school-<slug>|<identity organisation>` to `IDENTITY_SIGN_IN_CLIENTS` and switch
   `IDENTITY_SIGN_IN=enabled`.
4. Make sure each person who should sign in this way has a School user with the same email as
   their Identity account, and that the address is checked in Identity (company sign-in, or
   `operator-cli account-email-verified`). Administrators turn on two-step verification in
   Identity.

## Known limits
- `GET /api/v1/auth/identity/start` answers differently for a school code that is configured and
  one that is not. School codes are not secret (people type them on the sign-in page), and the
  route is rate limited; accepted.

- A School user whose `mustChangePassword` is set is still sent to the change-password page after
  signing in through Identity, as after any sign-in.
- Removing a person in Identity stops new sign-ins at once; an existing School session lasts until
  its refresh token expires or the person signs out (School sessions are School's own).

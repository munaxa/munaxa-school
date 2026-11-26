# Sign in with Munaxa Identity

School can sign people in through **Munaxa Identity** (munaxa-identity ADR-0008), so a school's
staff use one Munaxa sign-in, with Identity's MFA, lockout, session revocation and Microsoft or
Google company sign-in. Password sign-in is unchanged and stays available.

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

### Privileged accounts link by password once

Identity marks as verified any address an organisation administrator typed, so an email match
alone is not enough for an account that can administer the school or the platform. Users holding
a platform role, `SchoolAdmin`, `Principal`, `VicePrincipal`, `FinanceOfficer`, `Accountant` or
`HR` are never linked by email alone. The first time they use Munaxa sign-in they see
"sign in with your password once"; School keeps a sealed (HMAC), ten-minute link offer in a
`__Host-` cookie, and their next successful **password** sign-in at the same school, with the same
email, links the Identity account. From then on Munaxa sign-in works for them. Other users link on
first use by verified email, as above.

Outcomes the sign-in page explains: `?identity=unavailable` (school not configured),
`failed` (cancelled, expired, or any protocol check failed), `no-account` (no School user with
that email, or already linked to another Identity account), `blocked` (account disabled,
suspended, or the school's subscription refuses sign-in). The exact reason is in the API log and
the audit trail (`auth.identity.*`), never in the address bar.

## Configuration

| Variable | Value |
| --- | --- |
| `IDENTITY_SIGN_IN` | `enabled` or `disabled` (default) |
| `IDENTITY_ISSUER` | Identity's issuer (its `MUNAXA_TOKEN_ISSUER`), https in production |
| `IDENTITY_SIGN_IN_REDIRECT_URI` | `https://<school host>/api/v1/auth/identity/callback` |
| `IDENTITY_SIGN_IN_CLIENTS` | `school-slug\|client-id\|identity-organisation`, `;` between schools |
| `IDENTITY_SIGN_IN_CLIENT_SECRETS` | `client-id=<secret>`, `,` between. A secret: from the secret store only |
| `IDENTITY_PUBLIC_KEYS` | Identity's public signing keys, the same JSON Work reads |

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
   their Identity account.

## Known limits
- `GET /api/v1/auth/identity/start` answers differently for a school code that is configured and
  one that is not. School codes are not secret (people type them on the sign-in page), and the
  route is rate limited; accepted.

- A School user whose `mustChangePassword` is set is still sent to the change-password page after
  signing in through Identity, as after any sign-in.
- Removing a person in Identity stops new sign-ins at once; an existing School session lasts until
  its refresh token expires or the person signs out (School sessions are School's own).

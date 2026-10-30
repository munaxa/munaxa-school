# Token confusion review (30 October 2026)

What each School endpoint accepts as proof of identity, and whether a token of one kind can be
passed off as another. Scope: `apps/api` on `main` after #19.

## Tokens in play

| Token                         | Issued by                       | Accepted by                                     | Form                                                     |
| ----------------------------- | ------------------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| Access token                  | `TokenService.signAccessToken`  | the JWT guard on every authenticated route      | HS256 JWT, `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL` (900 s) |
| Refresh token                 | `TokenService.generateRefreshToken` | `POST /auth/refresh` only                   | 48 random bytes; only the SHA-256 is stored              |
| Firebase ID token             | Firebase                        | `POST /auth/session` only                       | verified by `firebase-admin` against the project         |
| `CONTROL_PLANE_TOKEN`         | munaxa-control                  | nothing in School: sent outbound only           | bearer credential                                        |
| Webhook signature             | School                          | receivers                                       | HMAC-SHA256 per endpoint secret                          |

## Findings

1. **Firebase exchange linked accounts by an unverified email. Critical when Firebase is
   configured; fixed in this change.** `exchangeFirebaseSession` linked a Firebase identity to the
   Munaxa user with the same email without checking `email_verified`. Anyone can create a Firebase
   account that claims any address (email/password sign-up), so with `FIREBASE_*` set (they are
   also used for push) an attacker could sign in as any user whose email they knew. Linking by
   email now requires `email_verified === true`; an identity already linked by uid is unaffected.
   `test/firebase-session.e2e-spec.ts` covers refusal, linking, and refusal after linking.
2. **Access tokens: no confusion found.** Only one JWT is signed with `JWT_ACCESS_SECRET`.
   Refresh tokens are opaque and looked up by hash, so an access token cannot be used as a refresh
   token or the reverse. Production requires both secrets and refuses equal values. The library is
   `jsonwebtoken` 9.0.3, which with a string secret already refused `none` and asymmetric
   algorithms; signing and verification now name `HS256` explicitly.
3. **Not fixed, recorded (low).** Access tokens carry no `iss`, `aud` or `typ`. Any other system
   that signs HS256 tokens with the same secret value would be accepted. Keep `JWT_ACCESS_SECRET`
   unique to this deployment (never shared with Work, Docs or Identity); adding `iss` and `aud`
   would end active sessions and is left for the Identity integration.

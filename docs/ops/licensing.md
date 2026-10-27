# Licensing

**For:** whoever runs Munaxa School — hosted by Munaxa, or on a school's own server.

`LICENSING_MODE` chooses where a school's entitlements come from:

| Mode | For | Decides |
| --- | --- | --- |
| `DATABASE` (default) | Hosted School as it has always run | The subscription plane in this database. A school with no subscription is permissive, by design, for schools that predate billing |
| `CONTROL_PLANE` | Munaxa-hosted School, managed from the Super Admin portal | The central Munaxa subscription service (`munaxa-control`), asked per school |
| `LICENSE_FILE` | A school's own server, possibly offline | A signed Munaxa licence on disk, verified with public keys only |

In both licensing modes the shared contract `@munaxa/licensing` decides, in place of the
subscription plane:

| Question | Answered by |
| --- | --- |
| Is a paid capability available? | The snapshot's `features`. Core School OS modules are never gated |
| What is a limit? | The snapshot's `limits` (`students`, `campuses`, `staff`, `storage_gb`); `null` is unlimited, absent is 0 |
| May the school write? | The status after dates: active, trial and past-due write; expired, suspended and cancelled are read-only through `ReadOnlyStateGuard` |
| May the school grow? | As above, and not while the service is unreachable for more than an hour (see below) |

Nothing in either mode falls back to the permissive "no subscription" default: a deleted licence
file, or a school the central service has no subscription for, grants nothing beyond the core
modules.

## Sign-in

Every school signs in except an **archived** one. A suspended, expired or cancelled school's users
sign in and read their records — the licensing contract keeps a customer's records reachable in
every state short of deletion — and `ReadOnlyStateGuard` refuses every change. An archived school
(School's own terminal state, after the retention period) is refused at login, at the Firebase
session exchange and at refresh, so an existing session ends at its next rotation. Platform staff
are never refused by a school's subscription. The decision is `SubscriptionService.signInRefusal`.

## Hosted: `CONTROL_PLANE`

```bash
LICENSING_MODE=CONTROL_PLANE
CONTROL_PLANE_URL=https://control.munaxa.com
CONTROL_PLANE_TOKEN=<this deployment's service credential, from the Super Admin portal>
```

- The token is a secret. Inject it from the secret store at runtime; never commit it or bake it
  into an image. Rotate it by issuing a new credential in the portal, deploying it, then revoking
  the old one.
- The API refuses to start without either variable, or with an `http://` URL in production.
- Each school is asked `GET /api/v1/products/school/tenants/{tenantId}/entitlements` with the
  credential, a 3-second timeout and no redirects, and the answer is reused for a minute. A
  suspension in the portal reaches every API process within that minute.
- The credential is bound to one deployment in the central service: it can only ask about schools
  linked to that deployment, and every other school reads as "no subscription".
- Student, campus and storage levels are reported back (`POST /api/v1/products/school/usage`) best
  effort. Reporting is informational; School enforces its own limits against its own rows.

### When the central service is unreachable

| Since the last answer | The school |
| --- | --- |
| Under an hour | Works normally |
| Up to a day | Works, but cannot add students, campuses or staff |
| Up to a week | Reads only |
| Longer | Core modules only, read-only |

A `401`/`403` (a revoked or mistyped credential) is an outage, not a cancellation, so a credential
mistake degrades schools over hours rather than locking them out at once — and it is logged on
every refresh. A `404` is an answer: no subscription. It applies at once and is not bridged by any
remembered answer.

The last answer for each school is kept in the `LicensingState` table, so a process that starts
while the service is down bridges the outage with it exactly as a running one would — degraded by
its age, by the table above. A school the service last answered "no subscription" for has no
snapshot to bridge with, and gets the core modules, read-only, until the service answers.

## On premises: `LICENSE_FILE`

```bash
LICENSING_MODE=LICENSE_FILE
LICENSE_FILE_PATH=/etc/munaxa/school.license
LICENSE_PUBLIC_KEYS='[{"kid":"<kid>","publicKey":"-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----"}]'
LICENSE_INSTALLATION_ID=<this server's identifier>
```

The API refuses to start if any of these is missing, or if `LICENSE_PUBLIC_KEYS` holds a private key.

- **Renew:** copy the new licence over the old one. It is re-read within a minute; no restart.
- **Replace the server:** a licence is bound to `LICENSE_INSTALLATION_ID`, so a new server stops
  verifying the old licence. Ask Munaxa for a reactivation (reason `SERVER_REPLACEMENT`, naming the
  old licence id) and install the licence that comes back; it supersedes the old one.

## Limits, stated rather than discovered

- A licence cannot be revoked offline; it is valid until it ends.
- Clock rollback: decisions are made at the later of the clock and the latest instant observed for
  the school, which `LicensingState.lastObservedAt` keeps across restarts and only ever moves
  forward. Winding the server clock back cannot make an ended term current, before or after a
  restart. A clock that was wrong from the first boot and never moved backwards cannot be detected.
- `LicensingState` is under the school's own row-level security and is created by the
  `20261027090000_licensing_state` migration; `infra/postgres/app-role.sql` (run after migrations
  in every deployment) grants the application role access to it.

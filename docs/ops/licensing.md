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
| What is a limit? | The snapshot's `limits` (`students`, `campuses`, `staff`, `storage_gb`); `null` is unlimited, absent is 0. Students, campuses, staff and storage are enforced (see below) |
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

## How counted limits are enforced

Students, campuses and staff are counted and enforced in every licensing mode, including `DATABASE`.
Each create counts the dimension and creates the record in **one transaction holding a per-tenant
lock** for that dimension, so concurrent requests queue rather than each seeing room for the last
place; ten simultaneous requests with room for three create exactly three
(`test/subscription-capacity.e2e-spec.ts`).

| Dimension | Counted | Enforced on |
| --- | --- | --- |
| Students | non-deleted students | the student form, the CSV import (the whole file fits or nothing is created) and admissions (family commit, add-to-family; re-enrolment creates no student) |
| Campuses | non-deleted campuses | campus creation |
| Staff | non-deleted employees whose status is on staff: `HIRED`, `PROBATION`, `ACTIVE`, `TRANSFERRED`, `PROMOTION`, `ON_LEAVE`, `SUSPENDED` | creating an employee on staff, and any transition that joins the staff (a hire). Candidates in the recruitment pipeline take no place |

Every change publishes the new total, which sets the usage table and, when hosted, is reported to
the central service: students, campuses, staff and storage.

### Storage

`storage_gb` is enforced against the bytes a school actually holds in the bucket, recorded in a
ledger (`StoredObject`, one row per object key), and **never against a size the client declares**.
Every upload path — homework, payment receipts, parent and employee documents, student resources,
branding assets, signed agreements — goes through `StorageService`, provided once for the API.

| Step | What happens |
| --- | --- |
| Issue an upload URL | Under the school's storage lock: expired reservations are settled first, then the declared size — or the per-upload ceiling (50 MB; 5 MB for images) when none is declared — is reserved for the URL's lifetime plus five minutes. Refused when stored bytes plus live reservations plus this one would pass the limit. The URL signs the declared length, so the bucket rejects a different body |
| Confirm the upload | The object's size is read from the bucket (`HEAD`), not from the request, and the limit is re-checked under the lock with that size in place of the reservation. Too large: the object is deleted and the confirmation refused. Not there: refused. Confirming the same key again counts it once |
| Replace or delete | Branding assets delete the object they replace or remove (unless another slot still uses it); agreements delete superseded copies. Each deletion releases its bytes |
| Upload never confirmed | When its reservation expires it is settled with what the bucket holds: counted if the object arrived, released if not |
| Reconciliation | `pnpm --filter @school/api storage:reconcile` lists each school's prefix and makes the ledger agree: unknown objects (never confirmed, or older than the ledger) are counted, objects gone from the bucket are released. A row changed after the listing began is left alone, so an upload confirmed or a file deleted while it runs is never miscounted. Run it daily, and once after the `stored_objects` migration first deploys so existing files count |

Ten simultaneous upload URLs with room for three issue exactly three
(`test/storage-quota.e2e-spec.ts`); without the lock, eight were issued. Usage is reported in whole
GB rounded up; the limit itself is held on exact bytes, in binary gigabytes (1 GB = 2^30 bytes).

Uploads are growth: under a licence or the central service, an upload is refused while the
subscription does not allow adding more, like any other create. The confirmation step is checked
the same way, so an upload started just before a suspension is deleted rather than kept.

The bucket role needs `s3:PutObject`, `s3:GetObject` (also used by `HEAD`), `s3:DeleteObject`, and
`s3:ListBucket` limited to the `tenants/` prefix (for reconciliation).

## Limits, stated rather than discovered

- A licence cannot be revoked offline; it is valid until it ends.
- Clock rollback: decisions are made at the later of the clock and the latest instant observed for
  the school, which `LicensingState.lastObservedAt` keeps across restarts and only ever moves
  forward. Winding the server clock back cannot make an ended term current, before or after a
  restart. A clock that was wrong from the first boot and never moved backwards cannot be detected.
- `LicensingState` is under the school's own row-level security and is created by the
  `20261027090000_licensing_state` migration; `infra/postgres/app-role.sql` (run after migrations
  in every deployment) grants the application role access to it.

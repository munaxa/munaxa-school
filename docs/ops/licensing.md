# On-premises licensing

**For:** whoever runs Munaxa School on a school's own server. **Not** for the hosted service,
where the subscription plane in the database decides, exactly as before.

## What it is

With `LICENSING_MODE=LICENSE_FILE` the API reads a signed Munaxa licence from disk and verifies it
offline with the shared contract `@munaxa/licensing` — no network, and public keys only, so an
installation can check a licence and cannot make one. The licence then decides, in place of the
subscription plane:

| Question | Answered by |
| --- | --- |
| Is a paid capability available? | The licence's `features`. Core School OS modules are never gated |
| What is a limit? | The licence's `limits` (`students`, `campuses`, `staff`, `storage_gb`); `null` is unlimited, absent is 0 |
| May the school write? | The licence's status after dates: active, trial and past-due write; grace stops nothing in School today; expired, suspended and cancelled are read-only through `ReadOnlyStateGuard` |

A licence that is missing, forged, bound to another installation or issued for another school
grants nothing beyond the core modules. It never falls back to the "no subscription" default, which
is permissive by design for hosted schools that predate billing — on premises that would make a
deleted licence file an unlimited one.

## Configure

```bash
LICENSING_MODE=LICENSE_FILE
LICENSE_FILE_PATH=/etc/munaxa/school.license
LICENSE_PUBLIC_KEYS='[{"kid":"<kid>","publicKey":"-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----"}]'
LICENSE_INSTALLATION_ID=<this server's identifier>
```

The API refuses to start if any of these is missing, or if `LICENSE_PUBLIC_KEYS` holds a private key.

## Renew, and replace the server

- **Renew:** copy the new licence over the old one. It is re-read within a minute; no restart.
- **Replace the server:** a licence is bound to `LICENSE_INSTALLATION_ID`, so a new server stops
  verifying the old licence. Ask Munaxa for a reactivation (reason `SERVER_REPLACEMENT`, naming the
  old licence id) and install the licence that comes back; it supersedes the old one.

## Limits, stated rather than discovered

- A licence cannot be revoked offline; it is valid until it ends.
- The latest instant observed is kept for the life of the process, so winding the clock back while
  the API runs is detected. Across a restart, only the licence's own issue time is a floor — School
  has no table to persist it in yet, unlike Munaxa Docs.
- Sign-in is not gated by subscription state in School today (`canLogin` in `@school/domain` has no
  caller); this change does not alter that.

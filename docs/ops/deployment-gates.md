# Deployment gates — no production deploy without an approval

Every workflow in this repository that can reach production runs a `production-gate` job before
any job that holds an environment. For the `production` target the gate reads the environment's
protection rules from the GitHub API (`scripts/deploy-gate.mjs verify-environment`) and **fails the
run before anything is built, migrated or deployed** unless all of these hold:

| Requirement | Why |
| --- | --- |
| The `production` environment exists | A job naming a missing environment creates it, unprotected |
| It has at least one **required reviewer** | The deploy job then waits in Actions for an approval |
| **Allow administrators to bypass** is off | An approval cannot be skipped by an admin push |
| **Deployment branches** are restricted to `main` (a single branch rule, or protected branches only) | A workflow on another branch cannot use the environment or its secrets |
| The run is on `refs/heads/main` | A manual run from another branch is refused even before the API is read |

The gate fails closed: if the API cannot be read, nothing deploys.

## What runs on a merge to `main`

| Workflow | Target on push | Production |
| --- | --- | --- |
| `deploy-cloudflare.yml` | `production` (`munaxademo` Worker) | Gate, then **waits for a reviewer**; without the settings below the run fails at the gate |
| `deploy.yml` | `staging` only (images, staging migrations once the database is declared, staging rollout) | Only by **Run workflow** with `environment: production`, gated the same way |
| `seed-environment.yml` | never (manual only) | Gated the same way |
| `ci.yml` | pull requests only | Never deploys; reports the gate's state on each PR |

Staging and production are separate GitHub environments with separate secrets; a merge never
targets production through `deploy.yml`.

## Required GitHub settings (one-time, repository admin)

**Settings → Environments → `production`** (<https://github.com/munaxa/munaxa-school/settings/environments>):

1. **Required reviewers**: tick it and add the people who may approve a production deploy.
   (Leave **Prevent self-review** off if a single person both merges and approves.)
2. **Allow administrators to bypass configured protection rules**: untick.
3. **Deployment branches and tags**: choose **Selected branches and tags** and add the single
   branch rule `main`.
4. **Environment secrets**: hold `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and
   `DIRECT_DATABASE_URL` (and `PLATFORM_OWNER_PASSWORD` if seeding) **here**, then delete any
   copy under **Settings → Secrets and variables → Actions → Repository secrets**. A repository
   secret is readable by any workflow on any branch; an environment secret only by a job that has
   passed the environment's rules.

5. **Environment variables** `DATABASE_ENVIRONMENT` = `production` and `DATABASE_HOST` = the host
   of the production database URL (variables, not secrets: they name, they do not grant).

Do the same for `staging`: its secrets, and `DATABASE_ENVIRONMENT` = `staging` with `DATABASE_HOST`
= the staging database's host (reviewers optional).

## Which database a job may change

`DIRECT_DATABASE_URL` is a secret, so nothing in a workflow — or in its logs — can show which
database it names; a `staging` secret that was really production's would be migrated on every
merge. Every job that migrates or seeds therefore runs `deploy-gate.mjs verify-database <target>`
before it connects, and stops unless the environment declares the database:
`DATABASE_ENVIRONMENT` equals the job's environment, and `DATABASE_HOST` equals the URL's host. A
repository-level variable cannot satisfy the production check by accident: it would say `staging`.
The URL is never printed. Until the variables are set, a merge's staging migration fails at this
step and changes nothing.

Until steps 1–3 are done, every production run fails at the gate with the missing setting named —
which is the intended, safe default. The `Deployment gates · production environment` step on each
pull request shows the current state as a warning.

## Keeping it that way

`scripts/deploy-gate.mjs lint` runs in CI (`Security scans`) and fails a pull request whose
workflows would route around the gate:

- a job with an environment that does not need `production-gate` (directly or transitively), or
  whose environment differs from the target the gate checks;
- a gate with an `if:`, `continue-on-error`, or an environment of its own;
- an `always()` / `failure()` / `cancelled()` condition on any job between the gate and a deploy;
- a deploying workflow triggered by pushes to anything but `main`;
- a job that reads a secret other than `GITHUB_TOKEN` / `PLATFORM_PACKAGES_TOKEN` without holding
  an environment;
- `pull_request_target`, `workflow_run`, or `secrets: inherit`.

Its tests are `node --test scripts/deploy-gate.test.mjs`.

The gate cannot stop someone with admin rights from changing the environment settings themselves;
that is what GitHub's audit log is for.

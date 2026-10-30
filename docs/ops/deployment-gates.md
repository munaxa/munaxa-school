# Deployment gates — nothing deploys on a merge, nothing deploys without an approval

A merge to `main` publishes no image, migrates no database, deploys no service and no Worker.
Every workflow that can do one of those is started by hand (**Actions → workflow → Run workflow**,
from `main`), and every job that does one holds a GitHub environment, so it waits for a
reviewer's approval. Before any of those jobs, the workflow's `production-gate` job checks the run
(`scripts/deploy-gate.mjs`) and **fails it before anything is pushed, migrated or deployed**
unless all of these hold:

| Requirement | Why |
| --- | --- |
| The run was started by hand, and its `confirm` input repeats the target (`verify-dispatch`) | The dispatch form preselects the first option, so a choice alone does not show anyone picked it |
| The target environment exists | A job naming a missing environment creates it, unprotected |
| It has at least one **required reviewer** | Each job that holds it waits in Actions for an approval |
| **Allow administrators to bypass** is off | An approval cannot be skipped by an admin |
| **Deployment branches and tags** name exactly one rule: the branch `main` (`production`, `staging`), or the tag `image/*` (`image-release`) | A workflow on another ref cannot use the environment or its secrets |
| The run is on that ref | A manual run from another branch is refused even before the API is read |

This holds for `staging` as much as for `production`. A target not listed in `TARGETS` in the
script is refused. The gate fails closed: if the API cannot be read, nothing runs. A refused or
missing approval leaves the job waiting, and nothing after it runs.

## What runs on a merge to `main`

Nothing that changes anything outside GitHub. `ci.yml` runs on pull requests only.

| Workflow | Trigger | Jobs with a side effect | Approval |
| --- | --- | --- | --- |
| `deploy.yml` | Run workflow: `environment` (staging or production), `confirm`, and a tick for each of `publish_images`, `migrate`, `deploy` (all off by default) | `build-images` (GHCR), `migrate` (database), `deploy` (rollout); each runs only if ticked and depends only on the gate | Each job holds the target environment, so each is approved on its own |
| `deploy-cloudflare.yml` | Run workflow, `confirm` = `production` | `deploy`: the `munaxademo` Worker | `production` |
| `seed-environment.yml` | Run workflow: `environment`, `confirm` | `seed` | The target environment |
| `publish-images-ecr.yml` | Run workflow from an `image/<sha>` tag | `publish`: ECR, through OIDC | `image-release` |

Run a migration in its own run before a rollout that needs it: `migrate` and `deploy` are
independent, so ticking both does not order them. The GHCR images (`deploy.yml`) stay the Render
fallback until the AWS deployment is validated; the ECR images (`publish-images-ecr.yml`) are
for AWS.

**Render** builds from this repository itself, outside GitHub Actions. `render.yaml` sets
`autoDeployTrigger: off` on both services, so a merge does not deploy them once the Blueprint is
synced; until then each service's own **Auto-Deploy** setting in the Render dashboard decides, and
it should be **Off**. Deploy with **Manual Deploy**. A deploy that fails to start leaves the previous
one serving.

**Workers.** This repository deploys only `munaxademo`. The lint refuses any workflow or wrangler
config that names `munaxa` (munaxa.com, deployed from munaxa/munaxa) or `canteenhub-prod` (an
unrelated product).

## Required GitHub settings (one-time, repository admin)

**Settings → Environments** (<https://github.com/munaxa/munaxa-school/settings/environments>), for
each of `production`, `staging` and `image-release`:

1. **Required reviewers**: tick it and add the people who may approve.
   (Leave **Prevent self-review** off if a single person both merges and approves.)
2. **Allow administrators to bypass configured protection rules**: untick.
3. **Deployment branches and tags**: choose **Selected branches and tags** and add the single
   rule: branch `main` for `production` and `staging`, tag `image/*` for `image-release`.
4. **Environment secrets** (`production`, `staging`): hold `CLOUDFLARE_API_TOKEN`,
   `CLOUDFLARE_ACCOUNT_ID` (production) and `DIRECT_DATABASE_URL` (and `PLATFORM_OWNER_PASSWORD` if
   seeding) **here**, then delete any copy under **Settings → Secrets and variables → Actions →
   Repository secrets**. A repository secret is readable by any workflow on any branch; an
   environment secret only by a job that has passed the environment's rules.
5. **Environment variables** (`production`, `staging`) `DATABASE_ENVIRONMENT` = the environment's
   name and `DATABASE_HOST` = the host of its database URL (variables, not secrets: they name,
   they do not grant).

Until steps 1 to 3 are done for an environment, every run that targets it fails at the gate with
the missing setting named, which is the intended, safe default. The `Deployment gates ·
environments` step on each pull request shows the current state of all three as warnings.

## Which database a job may change

`DIRECT_DATABASE_URL` is a secret, so nothing in a workflow — or in its logs — can show which
database it names; a `staging` secret that was really production's would be migrated on every
merge. Every job that migrates or seeds therefore runs `deploy-gate.mjs verify-database <target>`
before it connects, and stops unless the environment declares the database:
`DATABASE_ENVIRONMENT` equals the job's environment, and `DATABASE_HOST` equals the URL's host. A
repository-level variable cannot satisfy the production check by accident: it would say `staging`.
The URL is never printed. Until the variables are set, a staging migration fails at this step and
changes nothing.

Until steps 1–3 are done, every production run fails at the gate with the missing setting named —
which is the intended, safe default. The `Deployment gates · production environment` step on each
pull request shows the current state as a warning.

## Keeping it that way

`scripts/deploy-gate.mjs lint` runs in CI (`Security scans`) and fails a pull request whose
workflows would route around the gate:

- a workflow with an environment that runs on any trigger but `workflow_dispatch`;
- a job with an environment without `if: github.event_name == 'workflow_dispatch'`, or that does
  not need `production-gate` (directly or transitively), or whose environment differs from the
  target the gate checks;
- a gate that takes its target from an input but does not run `verify-dispatch` on it;
- a gate with an `if:`, `continue-on-error`, or an environment of its own;
- an `always()` / `failure()` / `cancelled()` condition on any job between the gate and a deploy;
- a job that can publish or deploy (`packages: write`, `id-token: write`, a pushing image build,
  `wrangler deploy`, `cf:deploy`) without holding an environment;
- a job that reads a secret other than `GITHUB_TOKEN` / `PLATFORM_PACKAGES_TOKEN` without holding
  an environment;
- a Worker deploy, in a workflow or a wrangler config, naming `munaxa` or `canteenhub-prod`;
- `pull_request_target`, `workflow_run`, or `secrets: inherit`.

Its tests are `node --test scripts/deploy-gate.test.mjs`. They include this repository's own
workflows: a push to `main` starts no job with a side effect, every such job holds an environment
behind the gate, and `deploy.yml` gates publishing, migrating and rolling out separately. CI also
runs actionlint on every workflow.

The gate cannot stop someone with admin rights from changing the environment settings themselves;
that is what GitHub's audit log is for.

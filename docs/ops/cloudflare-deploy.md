# Cloudflare Deploy — Munaxa standalone apps

Three apps deploy to Cloudflare from this repository:

| App | Path | Cloudflare Worker | Type | Adapter |
| --- | --- | --- | --- | --- |
| Demo | `school/munaxademo` | `munaxademo` | Workers | OpenNext (`@opennextjs/cloudflare`) |
| Landing | `school/landing` | **`munaxa`** | Workers | OpenNext (`@opennextjs/cloudflare`) |
| Platform docs (Storybook) | `platform` | `platform-storybook` | Workers (static assets) | Storybook static build |

> The landing site's Worker is named **`munaxa`**, not `landing` — that is the Worker
> `munaxa.com` is attached to. See [The Worker name is load-bearing](#the-worker-name-is-load-bearing).

All three are part of (or build against) the pnpm workspace, so **builds must run from the
repository root**. `cf-emit-root-wrangler.mjs` locates the workspace root by walking up to
`pnpm-workspace.yaml` and writes the app's real relative path into a root `wrangler.jsonc`, so
the `school/` nesting is handled automatically.

---

## How deploys run

**`.github/workflows/deploy-cloudflare.yml` — every merge to `main` deploys all three apps.**

The workflow runs each app's own `cf:deploy` script (the same one you run locally), so CI and a
developer's machine cannot drift apart. It also asserts, before deploying, that each
`wrangler.jsonc` names the Worker that app is supposed to deploy to.

Required repository secrets (Settings → Secrets and variables → Actions):

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Token with **Workers Scripts: Edit** on the account |
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account the three Workers live in |

The job targets the GitHub `production` environment, so required reviewers can be added there
if a human gate is ever wanted.

### No path filtering — deliberately

The workflow deploys all three apps on every merge, with no path filters. That is not an
oversight. Both Next apps render their entire UI from `@axa/platform`, and `cf:deploy` rebuilds
that dependency first, so "this merge changed nothing the app consumes" is not a judgement a
path filter can make correctly. A redundant deploy costs one short build; a skipped one costs a
silently stale production site.

### Cloudflare dashboard "Workers Builds" must be disconnected

Deployment previously ran through Cloudflare's dashboard Workers Builds, whose settings (build
watch paths, build/deploy commands, root directory) live outside this repository. **That is how
the live sites went stale with nothing going red:** a merge touching only `platform/` did not
match a project's build watch paths, so no build ran at all and the Worker kept serving its
previous bundle — green `main`, nothing in the dashboard to indicate a problem.

In **Workers & Pages → \<project\> → Settings → Builds**, disconnect the Git repository on all
three projects. Leaving it connected means two systems deploy the same Worker and the last one
to finish wins, which reintroduces exactly the nondeterminism this workflow removes.

> **Order matters — do not disconnect until the workflow has deployed successfully at least
> once.** This workflow can only deploy if GitHub Actions can run at all: on a private
> repository that means billed minutes, and if the account's spending limit is reached, jobs
> fail in a few seconds without ever being assigned a runner. Disconnecting Workers Builds
> before a green run leaves *nothing* deploying these Workers. Confirm a successful run under
> **Actions → Deploy Cloudflare**, then disconnect.

---

## The Worker name is load-bearing

`wrangler deploy` deploys to whatever `name` the config declares. If that name does not match an
existing Worker, **the deploy still succeeds** — wrangler creates a brand-new Worker, which no
custom domain points at. The live site keeps serving its old bundle indefinitely, and the deploy
log is green.

This is what broke the landing site: its config declared `"name": "landing"` while the Worker
serving `munaxa.com` is `munaxa`. The deploy workflow now asserts the name before deploying, so
the same drift fails loudly instead of silently.

When adding an app, add its row to the workflow's `matrix.include` alongside its expected Worker
name.

---

## Runtime secrets (set once per Worker, not in the repo)

These persist on the Worker across deploys — the workflow does not push them.

- `munaxa` (landing): `RESEND_API_KEY`, for the Contact-us emails. (`EMAIL_FROM`,
  `EMAIL_CONTACT_FROM` and `NEXT_PUBLIC_DEMO_URL` are non-secret and live in `wrangler.jsonc`.)
- `munaxademo`: `DEMO_SESSION_SECRET` (≥16 chars, required in production), `RESEND_DEMO`
  (or `RESEND_API_KEY`) for the "Book a Demo" intake email. KV namespace `DEMO_ACCOUNTS` is
  already bound in `wrangler.jsonc`.

Set each with `wrangler secret put <NAME>` from the app folder, or via the dashboard →
Settings → Variables and Secrets.

---

## Local verification

```bash
# Demo
pnpm --filter munaxademo run cf:build        # → .open-next/worker.js
pnpm --filter munaxademo run cf:preview      # optional: run it on workerd locally

# Landing
pnpm --filter @school/landing run cf:build
pnpm --filter @school/landing run cf:preview

# Storybook
pnpm --filter platform run build-storybook   # → storybook-static/
```

To deploy by hand (needs `CLOUDFLARE_API_TOKEN` in the environment), or to redeploy without a
merge, run the workflow from the Actions tab via **Run workflow** — it accepts
`workflow_dispatch`.

---

## Historical build failures (fixed in-repo, kept for context)

1. **`munaxademo` — wrong file-tracing root.** `next.config.mjs` pinned `outputFileTracingRoot`
   to the app directory. Once the demo joined the workspace that (a) stopped tracing the shared
   `@axa/platform` files into the standalone bundle and (b) produced a flat
   `.next/standalone/.next/...` layout while the OpenNext adapter expects the monorepo-nested
   `.next/standalone/school/munaxademo/.next/...` layout — failing with
   `ENOENT … pages-manifest.json`. Fixed by tracing from the workspace root.

2. **Landing — missing `cf:build` script.** The app had no `cf:build` script, so a build command
   of `pnpm run cf:build` failed with `ERR_PNPM_NO_SCRIPT`. Its scripts are now normalized to the
   same `cf:*` set as the demo.

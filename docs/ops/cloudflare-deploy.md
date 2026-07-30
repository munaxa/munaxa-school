# Cloudflare Deploy — Munaxa standalone apps

Three apps deploy to Cloudflare from this repository:

| App | Path | Project name | Type | Adapter |
| --- | --- | --- | --- | --- |
| Demo | `school/munaxademo` | `munaxademo` | Workers | OpenNext (`@opennextjs/cloudflare`) |
| Landing | `school/landing` | `landing` | Workers | OpenNext (`@opennextjs/cloudflare`) |
| Platform docs (Storybook) | `platform` | `platform-storybook` | Workers (static assets) | Storybook static build |

All three are part of (or build against) the pnpm workspace, so **builds must run from the
repository root** — that is the single thing that makes or breaks the deploy.

> **Since the AXA restructure**, the workspace root is the repository root and product code sits
> one level down under `school/`. The apps' own paths changed; the dashboard settings below did
> not (root directory is still `/`, and the filters still use package names). `cf-emit-root-wrangler.mjs`
> now locates the workspace root by walking up to `pnpm-workspace.yaml` and writes the app's real
> relative path into the emitted root `wrangler.jsonc`, so the extra nesting is handled
> automatically.

---

## Why the Workers builds were failing

1. **`munaxademo` — wrong file-tracing root (real build bug, now fixed in-repo).**
   `next.config.mjs` pinned `outputFileTracingRoot` to the app directory. That made sense when the
   demo was a standalone project, but once it joined the workspace it (a) stopped tracing the shared
   `@axa/platform` files into the standalone bundle and (b) produced a flat
   `.next/standalone/.next/...` layout while the OpenNext adapter expects the monorepo-nested
   `.next/standalone/school/munaxademo/.next/...` layout — so OpenNext failed with
   `ENOENT … pages-manifest.json`. Fixed by tracing from the workspace (repository) root.

2. **Landing — missing `cf:build` script (config mismatch).**
   The app's build itself is fine, but it had no `cf:build` script (only `deploy`/`cf:deps`), so a
   dashboard build command of `pnpm run cf:build` failed with `ERR_PNPM_NO_SCRIPT`. Its scripts are
   now normalized to the same `cf:*` set as the demo.

Both apps now build end-to-end locally:
`pnpm --filter <app> run cf:build` → `Worker saved in .open-next/worker.js 🚀`.

---

## Dashboard settings (the part that lives outside the repo)

For **each** Workers project (`munaxademo`, `landing`), set in
**Workers & Pages → <project> → Settings → Builds**:

| Setting | Value |
| --- | --- |
| **Git repository** | `tam2om/Munaxa` |
| **Root directory** | `/` (the **repository root** — *not* `school/` and *not* the app subfolder) |
| **Build command** | `pnpm --filter <app> run cf:build` |
| **Deploy command** | `pnpm --filter <app> exec wrangler deploy` |
| **Build watch paths** | `*` (see below) |

Replace `<app>` with `munaxademo` or `@school/landing`.

- Root directory **must** be `/` so Cloudflare installs the whole workspace (it reads the root
  `pnpm-lock.yaml`) and the shared `@school/*` packages resolve and build.
- `pnpm --filter <app> …` targets the right app from the root; `cf:build` first builds the shared
  packages (`cf:deps`) then runs `opennextjs-cloudflare build`.
- `pnpm --filter <app> exec wrangler deploy` runs wrangler **in the app folder**, so it picks up
  that app's `wrangler.jsonc` and the freshly built `.open-next/worker.js`.
- Node version: the repo pins **Node 22** via `.nvmrc`. If the build image defaults to something
  else, set the `NODE_VERSION` build variable to `22`.

#### Build watch paths — why they must not be scoped to the app folder

Workers Builds only starts a build when a push touches a **build watch path**. Scoping a project's
include paths to its own folder (`school/munaxademo/*`) looks tidy and is wrong here: both apps
render their entire UI from `@axa/platform`, and `cf:build` rebuilds that dependency first. A
platform-only or shared-package-only merge would then produce **no build at all**, and the live
Worker would keep serving the previous bundle — a silent stale deploy, with a green `main` and
nothing in the dashboard to indicate it.

Set **Include paths** to `*` on both projects. A merge that changes nothing they consume costs one
short cached build; the alternative costs correctness. If narrowing is ever justified, the minimum
correct set is the app folder **plus** every path its build reads: `platform/**`,
`school/packages/**`, `pnpm-lock.yaml` and `pnpm-workspace.yaml`.

### Runtime secrets (set once per project, not in the repo)

- `munaxademo`: `DEMO_SESSION_SECRET` (≥16 chars, required in production), `RESEND_DEMO`
  (or `RESEND_API_KEY`) for the "Book a Demo" intake email. KV namespace `DEMO_ACCOUNTS` is already
  bound in `wrangler.jsonc`.
- `landing`: `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`. KV namespace `RATE_LIMIT_KV` is bound.

Set each with `wrangler secret put <NAME>` (or the dashboard → Settings → Variables and Secrets).

---

## Platform docs — Storybook (Workers static assets)

The Platform's own documentation site is its Storybook, deployed as a **static-assets Worker**
named `platform-storybook`. `platform/wrangler.jsonc` points `assets.directory` at the
`storybook-static/` bundle `build-storybook` emits. Because the build runs from the repo root
(workspace install), the deploy and version commands invoke self-contained pnpm scripts that build
Storybook and then run wrangler with `platform/` as the working directory, so wrangler finds the
config with no `--config` flag:

| Dashboard field | Value |
| --- | --- |
| Build command | `echo skip` (the scripts build Storybook) |
| Deploy command (production) | `pnpm --filter platform run cf:deploy` |
| Version command (non-production) | `pnpm --filter platform run cf:versions` |
| Root directory | `/` |

The first production `cf:deploy` on `main` creates the Worker; non-production `cf:versions`
uploads preview versions of it thereafter.

---

## Local verification

```bash
# Demo
pnpm --filter munaxademo run cf:build        # → .open-next/worker.js
pnpm --filter munaxademo run cf:preview      # optional: run it on workerd locally

# Landing
pnpm --filter @school/landing run cf:build
pnpm --filter @school/landing run cf:preview
```

# Cloudflare Deploy — Munaxa standalone apps

Three apps deploy to Cloudflare from this repository:

| App | Path | Project name | Type | Adapter |
| --- | --- | --- | --- | --- |
| Demo | `school/munaxademo` | `munaxademo` | Workers | OpenNext (`@opennextjs/cloudflare`) |
| Landing | `school/landing` | `landing` | Workers | OpenNext (`@opennextjs/cloudflare`) |
| Design-system site | `school/munaxadesignsystem` | `designsystem` | Pages | Vite static build |

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

Replace `<app>` with `munaxademo` or `@school/landing`.

- Root directory **must** be `/` so Cloudflare installs the whole workspace (it reads the root
  `pnpm-lock.yaml`) and the shared `@school/*` packages resolve and build.
- `pnpm --filter <app> …` targets the right app from the root; `cf:build` first builds the shared
  packages (`cf:deps`) then runs `opennextjs-cloudflare build`.
- `pnpm --filter <app> exec wrangler deploy` runs wrangler **in the app folder**, so it picks up
  that app's `wrangler.jsonc` and the freshly built `.open-next/worker.js`.
- Node version: the repo pins **Node 22** via `.nvmrc`. If the build image defaults to something
  else, set the `NODE_VERSION` build variable to `22`.

### Runtime secrets (set once per project, not in the repo)

- `munaxademo`: `DEMO_SESSION_SECRET` (≥16 chars, required in production), `RESEND_DEMO`
  (or `RESEND_API_KEY`) for the "Book a Demo" intake email. KV namespace `DEMO_ACCOUNTS` is already
  bound in `wrangler.jsonc`.
- `landing`: `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`. KV namespace `RATE_LIMIT_KV` is bound.

Set each with `wrangler secret put <NAME>` (or the dashboard → Settings → Variables and Secrets).

---

## Design-system site (Pages — already green)

`munaxadesignsystem` deploys via **Cloudflare Pages** and is already passing. It consumes
`@school/design-tokens` by a `file:` dependency and imports `theme.oklch.css` directly, so as long
as the Pages build runs from the repo root (build command `pnpm --filter munaxadesignsystem run
cf:build`, output `dist/public`) the shared palette is included. No change needed.

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

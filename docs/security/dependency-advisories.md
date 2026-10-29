# Dependency advisories

CI (`Security scans`) runs `pnpm audit --audit-level high` on every pull request, over every
dependency including development tooling: a new high or critical advisory fails the build. It
replaces `pnpm audit --prod || true`, which reported but could never fail.

Fix an advisory by upgrading the package that brings it in. An override in the root `package.json`
(`pnpm.overrides`) is acceptable only when a parent pins the vulnerable version, so that no
compatible upgrade of the parent exists; each one is listed here with its removal condition.

## Overrides

| Override | Parent that pins it | Remove when |
| --- | --- | --- |
| `multer` → `^2.5.0` | `@nestjs/platform-express` 11 pins `multer` 2.4.0 | Nest platform-express ships ≥ 2.5.0 |
| `deepmerge-ts` → `^8.0.2` | `@prisma/config` 6 depends on `deepmerge-ts` 7 | Prisma's config package moves to 8 |
| `postcss` → `^8.5.25` | `next` 15 pins `postcss` 8.4.31 | Next.js stops pinning a vulnerable PostCSS |
| `js-yaml@5.2.1` → `^5.4.1` | `@nestjs/swagger` 11.4.6 pins `js-yaml` 5.2.1 | Nest swagger ships ≥ 5.4.1 |
| `glob@10.3.3` → `^10.5.0` | `@node-minify/core` (via `@opennextjs/cloudflare`) pins `glob` 10.3.3 | OpenNext's minifier moves past it |
| `vite` → `^7.3.7` | Vitest's automatically installed `vite` peer stays at its locked version | Any lockfile refresh lands Vite ≥ 7.3.7 for Vitest |

## Open findings (moderate and low only)

| Package | Path | Fix | Why it is still open |
| --- | --- | --- | --- |
| `@opentelemetry/core`, six `@opentelemetry/instrumentation-*` | `@sentry/nextjs` 9 → `@sentry/node` 9 | Sentry SDK 10 | A major SDK upgrade of the admin app's error reporting; its own change |
| `uuid` < 11.1.1 | `exceljs` → `uuid` 8; `@sentry/nextjs` → `@sentry/webpack-plugin` → `uuid` 9 | Sentry SDK 10 for the build plugin; none in `exceljs` | The advisory is v3/v5/v6 with a caller buffer; `exceljs` calls only `v4()` without one, the Sentry plugin runs at build time, and nothing here imports `uuid` |
| `deepmerge` ≤ 4.3.1 | `@nestjs/cli` → `fork-ts-checker-webpack-plugin` | none published | Build tool only; no fixed version exists |

## Remediation log

### 2026-10-29 — every high and critical advisory on `main`

`pnpm audit` on `main` reported 147 advisories (13 critical, 53 high, 66 moderate, 15 low). After
this change: 0 critical, 0 high, 8 moderate, 1 low (above).

- **Next.js** — `apps/admin` `15.1.4` → `15.5.28` and `munaxademo` `15.5.19` → `15.5.28`:
  middleware authorization bypass, React flight RCE, three unauthenticated RCE advisories, SSRF and
  several denial-of-service advisories. `sharp` now resolves to 0.35.5.
- **@sentry/nextjs / @sentry/nestjs** `^9.0.0` → `^9.47.2`: middleware bypass (critical).
- **Vitest** `^2.1.8` → `^4.1.12` (`packages/domain`, `packages/utils`): the Vitest UI arbitrary
  file read and `tinypool` prototype pollution to RCE (critical), and Vite 5's advisories.
- **Zod** `^3.24.1` → `^4.6.7` (`apps/api`, `packages/contracts`): memory exhaustion on oversized
  input; there is no fixed 3.x. `z.record` now names its key schema.
- **compression** `^1.8.1` → `^1.8.2`; **csv-parse** `^5` → `^7.0.3` (its stronger types made two
  casts redundant).
- **wrangler** `^4.100.0` → `^4.155.0` and **@opennextjs/cloudflare** → `^1.20.14` (`munaxademo`):
  Miniflare's pinned `sharp` and `undici`.
- **Transitive, refreshed within their ranges**: `handlebars` (critical JavaScript injection via
  `ts-jest`), `dompurify` (critical, via `posthog-js`), `fast-uri`, `@fastify/busboy`,
  `@grpc/grpc-js`, `body-parser`, `proxy-addr` (critical IP spoofing), `qs`, `brace-expansion`,
  `js-yaml` 3/4, `nanoid`, `source-map-js`, `undici`.
- **Overrides** as listed above.

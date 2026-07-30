# Munaxa — School Operating System (School OS)

Munaxa is a **production-grade, multi-tenant School Operating System** for K-12 schools, built for
the **Jordan** market (Arabic + English, RTL + LTR). It covers school administration, student &
people management, attendance, scheduling, finance, communication, and reporting.

> Munaxa is **not** an LMS. It integrates with Google Classroom and Microsoft Teams via **deep
> links only** and never duplicates LMS functionality.

## Layout

Munaxa is one product inside the [AXA workspace](../README.md). Its UI comes entirely from the
shared design system at [`/platform`](../platform/README.md) — there are no Munaxa-local
component or token packages.

```text
school/
├── apps/
│   ├── api/        # NestJS backend (modular monolith, DDD + Clean Architecture)
│   ├── admin/      # Next.js 15 Admin Portal (App Router, Tailwind v4)
│   └── mobile/     # Flutter apps (Parent / Student / Teacher flavors)
├── packages/
│   ├── domain/     # Framework-free domain enums/constants (roles, permissions, locale)
│   ├── contracts/  # Shared DTOs / zod schemas (API ⇄ Admin source of truth)
│   ├── utils/      # Cross-cutting helpers (Jordan validators, money)
│   └── i18n/       # en/ar message catalogs
├── landing/            # Marketing site (Next.js, Cloudflare Workers)
├── munaxademo/         # Hermetic public demo (Next.js, Cloudflare Workers)
├── prisma/         # Prisma schema & migrations (shared PostgreSQL)
├── infra/          # Postgres roles, load tests
├── scripts/        # Build/ops scripts
└── docs/           # Architecture (Phase 0) & runbooks
```

Shared, cross-product concerns live at the workspace root, not here:

| Concern                          | Location                                        |
| -------------------------------- | ----------------------------------------------- |
| Components, tokens, icons, theme | [`/platform`](../platform/README.md)             |
| ESLint / TypeScript bases        | [`/tooling`](../tooling)                         |
| Workspace, task graph, CI        | `/pnpm-workspace.yaml`, `/turbo.json`, `/.github` |

The Munaxa theme (`@axa/platform/css/themes/munaxa`) is the brand: teal `#007595`, its
palette authored in [`/platform/themes/munaxa`](../platform/themes/munaxa).

## Prerequisites
- Node.js 22+ · pnpm 10+ · Docker · (Flutter 3.24+ for mobile)

## Quick start

All commands run from the **repository root** (the workspace root), not from `school/`.

```bash
cp .env.example .env
cp school/apps/api/.env.example school/apps/api/.env
cp school/apps/admin/.env.example school/apps/admin/.env.local

pnpm install
pnpm docker:up            # Postgres (+ app role), Redis, LocalStack(S3), Mailhog
pnpm prisma:generate
pnpm prisma:migrate       # apply migrations (also seeds the global permission catalog)
pnpm --filter @school/api db:seed:demo   # demo school + admin login + a sample student
pnpm dev                  # runs api + admin via Turborepo
```

- API: http://localhost:4000/api/v1 — Swagger at `/api/docs`
- Admin: http://localhost:3000

**Demo login** (from `db:seed:demo`): tenant `demo` · `admin@demo.example` · `ChangeMe123!`

## Common scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run all apps in dev |
| `pnpm build` | Build all packages/apps |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Quality gates |
| `pnpm format` | Prettier write |
| `pnpm prisma:migrate` | Create/apply a dev migration (+ seeds permissions) |
| `pnpm --filter @school/api db:seed:demo` | Seed a demo school + admin login |
| `pnpm docker:up` / `pnpm docker:down` | Local infra |

## Documentation

Everything is indexed at [`docs/README.md`](./docs/README.md); the repository-wide index is
[`/docs/README.md`](../docs/README.md).

- **Contribution rules (mandatory)**: [`/PLATFORM_ENGINEERING_STANDARDS.md`](../PLATFORM_ENGINEERING_STANDARDS.md)
- **Session handoff / continuation guide**: [`docs/HANDOFF.md`](./docs/HANDOFF.md) — read first to resume work
- Architecture blueprint: [`docs/architecture/`](./docs/architecture/README.md)
- Business domains: [`docs/domains/`](./docs/domains/README.md)
- UX architecture and patterns: [`docs/ux/`](./docs/ux/README.md)
- UI governance: [`docs/ui-governance.md`](./docs/ui-governance.md)
- Shared platform: [`/platform/README.md`](../platform/README.md)
- Phase delivery history: [`docs/phases/`](./docs/phases/)
- Historical reports: [`docs/archive/`](./docs/archive/README.md)

## Phase status
- ✅ Phase 0 — System Architecture
- ✅ Phase 1 — Foundation Setup
- ✅ Phase 2 — Core Database Design
- ✅ Phase 3 — Authentication & RBAC
- ✅ Phase 4 — School Structure Management
- ✅ Phase 5 — People Management
- ✅ Phase 6 — Timetable Engine
- ✅ Phase 7 — Attendance System
- ✅ Phase 8 — Academics
- ✅ Phase 9 — Finance
- ✅ Phase 10 — Communication System
- ✅ Phase 11 — Parent Portal
- ✅ Phase 12 — Student App
- ✅ Phase 13 — Reporting
- ✅ Phase 14 — Advanced Modules
- ✅ Phase 15 — Production Hardening

Development is **phase-by-phase**; see `MunaxaPrompts/` for the original phase specifications
and [`docs/phases/`](./docs/phases/) for what each phase delivered.

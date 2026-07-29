# Prisma — Munaxa data layer

The Prisma schema is the source of truth for the shared PostgreSQL database. It is consumed by
`apps/api` (`@prisma/client`).

## Commands (run from repo root)

```bash
pnpm prisma:generate          # generate the Prisma client
pnpm prisma:migrate           # create & apply a dev migration
pnpm --filter @school/api prisma:deploy   # apply migrations in CI/prod
pnpm --filter @school/api prisma:studio   # open Prisma Studio
```

## Conventions (enforced from Phase 2)

- Every business entity carries a non-null `tenantId` (multi-tenant isolation — see
  `docs/architecture/03-multi-tenant-architecture.md`).
- UUID primary keys; `Decimal` for money (JOD); `timestamptz` timestamps; soft-delete via
  `deletedAt` where applicable.
- Tenant-scoped uniqueness (e.g. `@@unique([tenantId, email])`).
- Composite indexes lead with `tenantId`.
- Migration policy: expand → migrate → contract; pre-migration backup in production.
- PostgreSQL Row-Level Security policies are added as SQL migrations alongside Prisma migrations.

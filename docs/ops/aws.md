# School on the shared AWS stack

School's API and admin run on the shared AWS stack in `eu-central-1` (munaxa-platform
`infra/aws`, draft). This page is the School side of it: which images exist, how migrations run
and what is checked. The stack's README holds the approval gates, the runbook and the rollback.

**Status: not deployed.** Nothing here has created an AWS resource or published an image.

## Images

`.github/workflows/publish-images-ecr.yml` is run by hand from a tag `image/<40-hex commit SHA>`
on a commit that is on `main`. It runs in the protected `image-release` environment, behind the
repository's `production-gate` job, and pushes to Amazon ECR through GitHub OIDC (no registry
credential exists). Like every workflow here that has a side effect, it is dispatch-only
(docs/ops/deployment-gates.md); `image-release` must require a reviewer and admit only `image/*`
tags. It does nothing until the owner sets the repository variable `AWS_IMAGE_PUBLISHER_ROLE_ARN`.

| ECR repository        | Dockerfile target                 | Runs as                                     |
| --------------------- | --------------------------------- | ------------------------------------------- |
| `munaxa-school/api`   | `apps/api/Dockerfile` `runtime`   | `school-api` service, port 4000             |
| `munaxa-school/migrate` | `apps/api/Dockerfile` `migrate` | `school-migrate` run-only task              |
| `munaxa-school/admin` | `apps/admin/Dockerfile`, tagged `-nonprod` and `-prod` | `school-admin` service |

The admin bakes `NEXT_PUBLIC_API_URL` at build time, so it is built twice: `-nonprod` for
`school.test.munaxa.com` and `-prod` for `school.munaxa.com`. The stack routes `/api/v1/*` on the
School host to the API and everything else to the admin.

## Database and migrations

The stack's `db-admin` task creates the database `school_db`, the owner role `school_owner` and the
runtime role `munaxa_app` (`NOSUPERUSER`, `NOBYPASSRLS`), with passwords taken from the secret
bundles. No password is in a file.

The `migrate` image runs, with the owner URL from its own bundle (`DATABASE_MIGRATION_URL`):

1. `prisma migrate deploy`: the full migration history on a clean database. No data is copied
   from Supabase or Render.
2. `infra/postgres/runtime-grants.sql`: the runtime role's grants (the same as `app-role.sql`
   without creating the role), and `_prisma_migrations` revoked from it.

Both steps are idempotent. On AWS the database is private, so migrations run as this task, never
from a CI runner. `.github/workflows/deploy.yml` (GHCR images and CI-runner migrations for Render)
stays, dispatch-only, until Render is retired.

## Runtime configuration

Plain environment (stack `services.tf`): `NODE_ENV=production`, `PORT=4000`, `CORS_ORIGINS`,
`JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `EMAIL_SENDER_DOMAIN`, `LICENSING_MODE=CONTROL_PLANE` and
`CONTROL_PLANE_URL` (Control's API host). Production refuses `DATABASE` licensing (school#18).

Secrets (bundle `<env>/school-api`, read by the execution role only): `DATABASE_URL`,
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (different values), `CONTROL_PLANE_TOKEN` (issued in the
Control operator portal) and `RESEND_API_KEY` (sending access only).

## Checked locally (PostgreSQL 16, Docker)

- Roles created by the stack's `db-bootstrap.sh` as on RDS; the `migrate` image applied all 92
  migrations (179 tables) as `school_owner`, and a second run changed nothing.
- `munaxa_app` cannot bypass RLS, cannot create tables and cannot read `_prisma_migrations`.
- The `runtime` image started read-only, with all capabilities dropped and the stack's environment:
  `/api/v1/health/ready` answered 200 with the database up, an unauthenticated request answered
  401, and the RBAC sync ran as `munaxa_app`.

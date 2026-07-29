# syntax=docker/dockerfile:1
# Multi-stage build for the Munaxa API. Build context MUST be the repository root
# (the AXA workspace root). Example: docker build -f school/apps/api/Dockerfile -t munaxa-api .

ARG NODE_VERSION=22-alpine

# ---------- Base ----------
FROM node:${NODE_VERSION} AS base
RUN corepack enable
WORKDIR /repo

# ---------- Dependencies ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json ./
COPY tooling/ tooling/
COPY platform/ platform/
COPY school/apps/api/package.json school/apps/api/
COPY school/packages/ school/packages/
COPY school/prisma/ school/prisma/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- Build ----------
FROM deps AS build
COPY . .
RUN pnpm --filter @school/api prisma:generate \
    && pnpm --filter @school/api... build
# Assemble a self-contained production bundle. In a pnpm workspace each package's
# dependencies live under apps/api/node_modules (symlinked into node_modules/.pnpm),
# NOT in the root node_modules — so copying /repo/node_modules alone leaves the API's
# own deps (@nestjs/*, @sentry/nestjs, the @school/* workspace packages) missing at
# runtime. `pnpm deploy` collects exactly the production dependency closure (workspace
# packages injected as real files) into one node_modules. `--legacy` is required since
# pnpm 10 for workspaces that don't set inject-workspace-packages=true.
#
# `pnpm deploy` does NOT carry over the `prisma generate` output (the generated client
# under node_modules/.prisma), so regenerate it INTO the bundle afterwards.
RUN pnpm --filter @school/api --prod --legacy deploy /prod/api \
    && cp -r school/prisma /prod/api/prisma \
    && (cd /prod/api && /repo/node_modules/.bin/prisma generate --schema=/prod/api/prisma/schema.prisma)

# ---------- Runtime ----------
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Non-root user (security hardening)
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

# Complete prod node_modules from the deploy bundle; dist from the build output.
COPY --from=build /prod/api/node_modules ./node_modules
COPY --from=build /repo/school/apps/api/dist ./dist
COPY --from=build /repo/school/apps/api/package.json ./package.json
COPY --from=build /repo/school/prisma ./prisma

USER nestjs
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]

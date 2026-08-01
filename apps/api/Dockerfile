# syntax=docker/dockerfile:1
# Multi-stage build for the Munaxa School API. Build context MUST be this repository's
# root. Example: docker build -f apps/api/Dockerfile -t munaxa-school-api .
#
# The shared design system is a registry dependency (@munaxa/*), not a workspace member,
# so the build needs a token with `read:packages`:
#   docker build --secret id=github_token,env=GITHUB_TOKEN -f apps/api/Dockerfile .

ARG NODE_VERSION=22-alpine

# ---------- Base ----------
FROM node:${NODE_VERSION} AS base
RUN corepack enable
WORKDIR /repo

# ---------- Dependencies ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/
COPY prisma/ prisma/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    --mount=type=secret,id=github_token,env=GITHUB_TOKEN,required=false \
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
# `pnpm deploy` re-resolves the production closure, so it needs registry credentials
# just as much as the install above. It resolves from the destination (/prod/api), where
# the repo's own .npmrc does not apply — hence the user-level file written here, which is
# honoured regardless of working directory. Written and removed inside a single RUN so the
# token never reaches a committed layer.
RUN --mount=type=secret,id=github_token,env=GITHUB_TOKEN,required=false \
    set -eu; \
    if [ -n "${GITHUB_TOKEN:-}" ]; then \
      printf '@munaxa:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=%s\n' "$GITHUB_TOKEN" > /root/.npmrc; \
    fi; \
    pnpm --filter @school/api --prod --legacy deploy /prod/api; \
    cp -r prisma /prod/api/prisma; \
    (cd /prod/api && /repo/node_modules/.bin/prisma generate --schema=/prod/api/prisma/schema.prisma); \
    rm -f /root/.npmrc

# ---------- Runtime ----------
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Non-root user (security hardening)
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

# Complete prod node_modules from the deploy bundle; dist from the build output.
COPY --from=build /prod/api/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/prisma ./prisma

USER nestjs
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]

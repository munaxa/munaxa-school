# syntax=docker/dockerfile:1
# Multi-stage build for the Munaxa Admin Portal (Next.js standalone).
# Build context MUST be this repository's root:
#   docker build -f apps/admin/Dockerfile -t munaxa-school-admin .
#
# The shared design system is a registry dependency (@munaxa/*), not a workspace member,
# so the build needs a token with `read:packages`:
#   docker build --secret id=github_token,env=GITHUB_TOKEN -f apps/admin/Dockerfile .

# One operating system for every stage, pinned by digest so a rebuild of the same commit starts from
# the same bytes: the base Munaxa Identity ships (identity apps/api/Dockerfile, identity#20),
# node:22-alpine (Node 22.23.5, Alpine 3.24.4) as published on 11 Nov 2026, with zlib raised to
# 1.4-r0. The floating `node:22-alpine` tag this file used before resolved to zlib 1.3.2-r1, which
# ECR rates CVE-2026-4738 CRITICAL (it is the finding in munaxa-work/api:b490b25, built the same
# way). Alpine's aports secfixes list the fix in zlib 1.4-r0 (main/zlib/APKBUILD, 3.24-stable).
# When an official node:22-alpine digest ships zlib 1.4 or later, move the pin and drop the upgrade.
# The version is exact, so if Alpine replaces 1.4-r0 the build fails here instead of drifting.
# .github/scripts/verify-image.sh checks the result.
ARG NODE_IMAGE=node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a

FROM ${NODE_IMAGE} AS os
# The split is the point: `apk list -I zlib` prints `zlib-<version> <arch> ...` and $1 is the first word.
# hadolint ignore=SC2046
RUN apk add --no-cache 'zlib=1.4-r0' && \
    set -- $(apk list -I zlib 2>/dev/null) && installed="${1#zlib-}" && \
    if [ "$installed" != "1.4-r0" ]; then \
      echo "zlib is '$installed', expected 1.4-r0 (CVE-2026-4738)" >&2; exit 1; \
    fi

FROM os AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json ./
COPY apps/admin/package.json apps/admin/
COPY packages/ packages/
# The committed .npmrc holds only the scope mapping — pnpm refuses env-var auth from a
# project .npmrc. Write the credential to the user-level file from the secret, and remove
# it in the same RUN so the token never lands in a committed layer.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    --mount=type=secret,id=github_token,env=GITHUB_TOKEN,required=false \
    set -eu; \
    if [ -n "${GITHUB_TOKEN:-}" ]; then \
      printf '//npm.pkg.github.com/:_authToken=%s\n' "$GITHUB_TOKEN" > /root/.npmrc; \
    fi; \
    pnpm install --frozen-lockfile; \
    rm -f /root/.npmrc

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time. Declare them as
# build args (Render passes matching service env vars into the Docker build only when an
# ARG of the same name exists) and promote to ENV so `next build` picks them up. Without
# this the admin falls back to http://localhost:4000/api/v1 and the browser can't reach
# the API.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ENV
# Optional host-based separation (two custom domains on one service). When set, the app host
# serves the school portal and the console host serves only the Platform Console. Unset = one
# shared domain (default). Inlined at build so the client nav mirrors the middleware.
ARG NEXT_PUBLIC_APP_HOST
ARG NEXT_PUBLIC_CONSOLE_HOST
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_ENV=$NEXT_PUBLIC_ENV \
    NEXT_PUBLIC_APP_HOST=$NEXT_PUBLIC_APP_HOST \
    NEXT_PUBLIC_CONSOLE_HOST=$NEXT_PUBLIC_CONSOLE_HOST
RUN pnpm --filter @school/admin... build

FROM os AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Next.js standalone output (output: 'standalone'): a self-contained server with only the
# runtime node_modules it needs — no full workspace node_modules in the image. In a pnpm
# workspace the server lands at <standalone>/apps/admin/server.js.
COPY --from=build --chown=nextjs:nodejs /repo/apps/admin/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/admin/public ./apps/admin/public

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/admin/server.js"]

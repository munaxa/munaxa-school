# syntax=docker/dockerfile:1
# Multi-stage build for the Munaxa Admin Portal (Next.js standalone).
# Build context MUST be this repository's root:
#   docker build -f apps/admin/Dockerfile -t munaxa-school-admin .
#
# The shared design system is a registry dependency (@munaxa/*), not a workspace member,
# so the build needs a token with `read:packages`:
#   docker build --secret id=github_token,env=GITHUB_TOKEN -f apps/admin/Dockerfile .

ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base
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

FROM node:${NODE_VERSION} AS runtime
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

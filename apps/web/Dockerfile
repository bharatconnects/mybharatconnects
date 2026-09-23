# SSR image — serves ONLY the hybrid-rendering routes listed as
# RenderMode.Server in src/app/app.routes.server.ts (currently just the
# Phase A /ssr-test placeholder; /blog and /community land in later
# phases). Everything else stays a static SPA served by Amplify — this
# image is never the primary way the site is served.
#
# node:22 to match apps/api/Dockerfile's pin (see that file's comment —
# undici@8 needs Node >=22.19); no reason for the two runtimes to drift.
FROM public.ecr.aws/docker/library/node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration production,ssr

# ── Stage 2: production image ──────────────────────────────────────
FROM public.ecr.aws/docker/library/node:22-alpine AS runner

WORKDIR /app

# Install only production dependencies (express is a runtime dep of
# src/server.ts — the Angular/build toolchain itself is devDependencies
# and not needed here).
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Compiled output — server.mjs resolves the browser bundle via a relative
# '../browser' path (see src/server.ts), so both dist/web/server and
# dist/web/browser must be copied together, same relative layout as build.
COPY --from=builder /app/dist/web ./dist/web

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

ENV PORT=4000
EXPOSE 4000

CMD ["node", "dist/web/server/server.mjs"]

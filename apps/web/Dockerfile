# Web UI image (Next.js). Build from the repo root:
#   docker build -f apps/web/Dockerfile .
# It has no database access — it talks to the API at $API_URL.

# ─────────────────────────────────────────────
# Stage 1: deps
# ─────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json        apps/api/
COPY apps/web/package.json        apps/web/
COPY packages/shared/package.json packages/shared/

RUN npm ci -w @golfnme/web -w @golfnme/shared --include-workspace-root

# ─────────────────────────────────────────────
# Stage 2: builder
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app ./
# .env (if present) supplies the NEXT_PUBLIC_* values inlined at build time.
COPY package.json .env* ./
COPY packages/shared packages/shared
COPY apps/web        apps/web

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @golfnme/web

# ─────────────────────────────────────────────
# Stage 3: runner
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Standalone bundle is traced from the repo root, so it keeps the
# apps/web/ prefix (see outputFileTracingRoot in next.config.mjs).
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public           ./apps/web/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/login > /dev/null || exit 1

CMD ["node", "apps/web/server.js"]

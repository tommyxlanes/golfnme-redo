# API + BullMQ worker image. Build from the repo root:
#   docker build -f apps/api/Dockerfile .
# The same image runs either process — the worker overrides ENTRYPOINT/CMD
# in docker-compose.yml.

# ─────────────────────────────────────────────
# Stage 1: deps
# ─────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json        apps/api/
COPY apps/web/package.json        apps/web/
COPY packages/shared/package.json packages/shared/
# The API's postinstall runs `prisma generate`, which needs the schema.
COPY apps/api/prisma              apps/api/prisma

RUN npm ci -w @golfnme/api -w @golfnme/shared --include-workspace-root

# ─────────────────────────────────────────────
# Stage 2: runner
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl netcat-openbsd
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 api

COPY --from=deps /app ./
COPY packages/shared packages/shared
COPY apps/api        apps/api

WORKDIR /app/apps/api
RUN npx prisma generate

# entrypoint.sh waits for Postgres and runs `prisma migrate deploy`;
# worker-entrypoint.sh only waits (the api container owns migrations).
COPY docker/scripts/entrypoint.sh        /entrypoint.sh
COPY docker/scripts/worker-entrypoint.sh /worker-entrypoint.sh
RUN chmod +x /entrypoint.sh /worker-entrypoint.sh && chown -R api:nodejs /app

USER api

EXPOSE 4000
ENV API_PORT=4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npx", "--no-install", "tsx", "src/server.ts"]

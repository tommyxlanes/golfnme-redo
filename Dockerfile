# ─────────────────────────────────────────────
# Stage 1: deps
# ─────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ─────────────────────────────────────────────
# Stage 2: builder
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client for the build platform
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
# Requires next.config.mjs to have output: "standalone"
RUN npm run build

# ─────────────────────────────────────────────
# Stage 3: runner
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl netcat-openbsd
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Prisma: schema for migrate deploy + generated client
COPY --from=builder /app/prisma                    ./prisma
COPY --from=builder /app/node_modules/.prisma      ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma      ./node_modules/@prisma

# Next.js standalone bundle
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

# Custom server (Socket.io) + full node_modules for tsx + prisma CLI
COPY --from=deps    /app/node_modules   ./node_modules
COPY --from=builder /app/server.ts      ./server.ts
COPY --from=builder /app/tsconfig.json  ./tsconfig.json
COPY --from=builder /app/src/lib/socket.ts ./src/lib/socket.ts

# Entrypoint: runs `prisma migrate deploy` then starts the server
COPY docker/scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node_modules/.bin/tsx", "server.ts"]

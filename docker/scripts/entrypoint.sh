#!/bin/sh
# docker/scripts/entrypoint.sh
#
# Runs as the container's CMD wrapper.
# Handles the migrate-then-start pattern so the app never boots
# against an un-migrated schema.
#
# Usage in Dockerfile:
#   COPY docker/scripts/entrypoint.sh /entrypoint.sh
#   RUN chmod +x /entrypoint.sh
#   ENTRYPOINT ["/entrypoint.sh"]
#   CMD ["node_modules/.bin/tsx", "server.ts"]

set -e

echo "[entrypoint] Starting golfnme..."
echo "[entrypoint] NODE_ENV=${NODE_ENV}"

# ── Wait for Postgres ─────────────────────────────────────────────────────────
# Docker healthchecks handle this in Compose, but a direct entrypoint wait
# guards against edge cases (e.g. Coolify / bare docker run without compose).
if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] Waiting for Postgres..."
  # Extract host and port from DATABASE_URL
  # postgresql://user:pass@host:5432/db
  DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^@]+@([^:/]+).*|\1|')
  DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^@]+@[^:]+:([0-9]+).*|\1|')
  DB_PORT="${DB_PORT:-5432}"

  MAX_TRIES=30
  TRIES=0
  until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
    TRIES=$((TRIES + 1))
    if [ "$TRIES" -ge "$MAX_TRIES" ]; then
      echo "[entrypoint] ERROR: Postgres not reachable after ${MAX_TRIES}s — aborting"
      exit 1
    fi
    echo "[entrypoint] Postgres not ready (${TRIES}/${MAX_TRIES}) — retrying in 1s..."
    sleep 1
  done
  echo "[entrypoint] Postgres is up"
fi

# ── Run migrations ────────────────────────────────────────────────────────────
echo "[entrypoint] Running prisma migrate deploy..."
npx prisma migrate deploy
echo "[entrypoint] Migrations complete"

# ── Hand off to the app ───────────────────────────────────────────────────────
echo "[entrypoint] Executing: $*"
exec "$@"

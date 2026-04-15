#!/bin/sh
# docker/scripts/worker-entrypoint.sh
#
# Worker variant — waits for Postgres to be reachable but does NOT
# run migrations. The app container owns the migration step.
# Worker depends_on app via healthcheck so by the time this runs,
# migrations are already applied.

set -e

echo "[worker-entrypoint] Starting worker..."

if [ -n "$DATABASE_URL" ]; then
  DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^@]+@([^:/]+).*|\1|')
  DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^@]+@[^:]+:([0-9]+).*|\1|')
  DB_PORT="${DB_PORT:-5432}"

  MAX_TRIES=30
  TRIES=0
  until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
    TRIES=$((TRIES + 1))
    if [ "$TRIES" -ge "$MAX_TRIES" ]; then
      echo "[worker-entrypoint] ERROR: Postgres not reachable — aborting"
      exit 1
    fi
    echo "[worker-entrypoint] Waiting for Postgres (${TRIES}/${MAX_TRIES})..."
    sleep 1
  done
  echo "[worker-entrypoint] Postgres is up"
fi

echo "[worker-entrypoint] Executing: $*"
exec "$@"

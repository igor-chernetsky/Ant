#!/bin/sh
set -e

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

if [ -z "${KEYCLOAK_ISSUER:-}" ] || [ -z "${KEYCLOAK_JWKS_URI:-}" ]; then
  echo "ERROR: KEYCLOAK_ISSUER and KEYCLOAK_JWKS_URI must be set (check infra/.env)"
  exit 1
fi

# Allow one-off commands, e.g. docker compose run api npx prisma migrate deploy
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

echo "Running database migrations..."
# One-time recovery: clarification migration failed on PG < 15 when ADD VALUE
# and UPDATE ran in the same transaction. Re-apply is safe (IF NOT EXISTS + separate backfill).
npx prisma migrate resolve --rolled-back "20260727180000_project_status_clarification" 2>/dev/null || true
npx prisma migrate deploy

echo "Starting API on port ${PORT:-3000}..."
exec node dist/main.js

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

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting API on port ${PORT:-3000}..."
exec node dist/main.js

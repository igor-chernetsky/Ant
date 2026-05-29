#!/usr/bin/env bash
# Deploy API (and Caddy config) on EC2. Run manually or from GitHub Actions.
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/construction-platform}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.ec2.yml}"
BRANCH="${DEPLOY_BRANCH:-main}"

cd "$REPO_DIR"

echo "==> Fetch latest code ($BRANCH)"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

cd infra

echo "==> Build API image"
docker compose -f "$COMPOSE_FILE" build api

echo "==> Apply database migrations"
docker compose -f "$COMPOSE_FILE" up -d postgres
docker compose -f "$COMPOSE_FILE" run --rm api npx prisma migrate deploy

echo "==> Start / restart services"
docker compose -f "$COMPOSE_FILE" up -d api caddy keycloak

echo "==> Health check (local via Caddy)"
sleep 3
if curl -sf --connect-timeout 5 --max-time 10 "http://127.0.0.1/api/health" | grep -q '"status":"ok"'; then
  echo "Local health OK"
else
  echo "WARNING: local health check failed — check: docker compose logs api"
  exit 1
fi

echo "==> Deploy finished successfully"

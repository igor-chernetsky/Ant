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

echo "==> Health check"
sleep 3
curl -sf "http://127.0.0.1/api/health" | grep -q '"status":"ok"' \
  || curl -sf "https://iabuilding.duckdns.org/api/health" | grep -q '"status":"ok"'

echo "==> Deploy finished successfully"

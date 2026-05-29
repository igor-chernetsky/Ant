#!/usr/bin/env bash
# Deploy API on EC2. Typical runtime: 3–10 min (mostly docker compose build api).
set -euo pipefail

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

REPO_DIR="${REPO_DIR:-$HOME/construction-platform}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.ec2.yml}"
BRANCH="${DEPLOY_BRANCH:-main}"

cd "$REPO_DIR"

log "Fetch latest code ($BRANCH)"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

cd infra

log "Ensure Postgres is up"
docker compose -f "$COMPOSE_FILE" up -d postgres

log "Build API image (this is the slow step on EC2)"
docker compose -f "$COMPOSE_FILE" build api

log "Start API container"
docker compose -f "$COMPOSE_FILE" up -d api

log "Apply database migrations"
docker compose -f "$COMPOSE_FILE" exec -T api npx prisma migrate deploy

log "Restart edge services if needed"
docker compose -f "$COMPOSE_FILE" up -d caddy keycloak

log "Local health check"
sleep 2
if curl -sf --connect-timeout 5 --max-time 10 "http://127.0.0.1/api/health" | grep -q '"status":"ok"'; then
  log "Deploy finished — health OK"
else
  log "ERROR: health check failed"
  docker compose -f "$COMPOSE_FILE" logs api --tail=30
  exit 1
fi

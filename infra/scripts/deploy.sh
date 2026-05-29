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

log "Stop leftover one-off API containers (from failed deploys)"
docker ps -q --filter "name=construction-platform-api-run" | xargs -r docker stop 2>/dev/null || true

log "Ensure Postgres is up"
docker compose -f "$COMPOSE_FILE" up -d postgres

log "Build API image (this is the slow step on EC2)"
docker compose -f "$COMPOSE_FILE" build api

log "Start API (entrypoint runs migrate + node)"
docker compose -f "$COMPOSE_FILE" up -d --force-recreate api

log "Restart edge services if needed"
docker compose -f "$COMPOSE_FILE" up -d caddy keycloak

log "Wait for API"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf --connect-timeout 3 --max-time 5 "http://127.0.0.1/api/health" | grep -q '"status":"ok"'; then
    log "Deploy finished — health OK"
    exit 0
  fi
  sleep 2
done

log "ERROR: health check failed"
docker compose -f "$COMPOSE_FILE" logs api --tail=40
exit 1

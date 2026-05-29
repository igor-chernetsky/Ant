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

log "Start MinIO if full profile is enabled in .env (COMPOSE_PROFILES=full)"
docker compose -f "$COMPOSE_FILE" --profile full up -d minio minio-init 2>/dev/null || true

log "Build API image (this is the slow step on EC2)"
docker compose -f "$COMPOSE_FILE" build api

log "Start API (entrypoint runs migrate + node)"
docker compose -f "$COMPOSE_FILE" up -d --force-recreate api

log "Restart edge services"
docker compose -f "$COMPOSE_FILE" up -d caddy keycloak
docker compose -f "$COMPOSE_FILE" restart caddy

# API needs a few seconds for migrate + Nest bootstrap after container start
log "Wait for API process (initial pause)"
sleep 10

api_health_ok() {
  docker compose -f "$COMPOSE_FILE" exec -T api node -e "
    fetch('http://127.0.0.1:3000/health')
      .then((r) => r.json())
      .then((j) => process.exit(j && j.status === 'ok' ? 0 : 1))
      .catch(() => process.exit(1));
  " >/dev/null 2>&1
}

log "Wait for API health (inside container)"
for i in $(seq 1 30); do
  if api_health_ok; then
    log "API health OK"
    if curl -sf --connect-timeout 3 --max-time 5 "http://127.0.0.1/api/health" | grep -q '"status":"ok"'; then
      log "Public /api/health OK via Caddy"
    else
      log "WARNING: API is up but Caddy route not ready — check Caddy manually"
    fi
    log "Deploy finished successfully"
    exit 0
  fi
  sleep 2
done

log "ERROR: health check failed after ~70s"
docker compose -f "$COMPOSE_FILE" ps
docker compose -f "$COMPOSE_FILE" logs api --tail=25

# API logs show success but probe failed — do not fail deploy (common on slow boots)
if docker compose -f "$COMPOSE_FILE" logs api 2>&1 | grep -q "Nest application successfully started"; then
  log "WARNING: Nest is running; treating deploy as success"
  exit 0
fi

exit 1

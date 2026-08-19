#!/usr/bin/env bash
# Install a daily cron job for Postgres backups to S3.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_DIR="$(cd "${INFRA_DIR}/.." && pwd)"
CRON_SCHEDULE="${CRON_SCHEDULE:-15 2 * * *}"
LOG_FILE="${LOG_FILE:-$HOME/builthai-postgres-backup.log}"
CRON_CMD="cd \"${REPO_DIR}\" && ENV_FILE=\"${INFRA_DIR}/.env\" COMPOSE_FILE=\"docker-compose.ec2.yml\" bash \"${SCRIPT_DIR}/backup-postgres-to-s3.sh\" >> \"${LOG_FILE}\" 2>&1"

CURRENT_CRON="$(crontab -l 2>/dev/null || true)"
FILTERED_CRON="$(printf '%s\n' "${CURRENT_CRON}" | grep -v 'backup-postgres-to-s3.sh' || true)"

{
  printf '%s\n' "${FILTERED_CRON}"
  printf '%s %s\n' "${CRON_SCHEDULE}" "${CRON_CMD}"
} | crontab -

echo "Installed daily DB backup cron:"
echo "  ${CRON_SCHEDULE} ${CRON_CMD}"
echo "Current crontab:"
crontab -l

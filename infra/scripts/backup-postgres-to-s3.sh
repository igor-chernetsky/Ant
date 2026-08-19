#!/usr/bin/env bash
# Create a compressed Postgres backup from the EC2 docker-compose stack
# and upload it to AWS S3.
set -euo pipefail

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${INFRA_DIR}/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.ec2.yml}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Env file not found: ${ENV_FILE}"
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required. Install AWS CLI v2 and configure credentials."
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

: "${S3_BUCKET:?S3_BUCKET is required in ${ENV_FILE}}"
: "${POSTGRES_USER:?POSTGRES_USER is required in ${ENV_FILE}}"
: "${POSTGRES_DB:?POSTGRES_DB is required in ${ENV_FILE}}"

# AWS CLI credential mapping (see setup-s3-backup-lifecycle.sh)
if [[ -z "${AWS_ACCESS_KEY_ID:-}" && -n "${S3_ACCESS_KEY_ID:-}" ]]; then
  export AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}"
fi
if [[ -z "${AWS_SECRET_ACCESS_KEY:-}" && -n "${S3_SECRET_ACCESS_KEY:-}" ]]; then
  export AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}"
fi
if [[ -z "${AWS_DEFAULT_REGION:-}" && -n "${S3_REGION:-}" ]]; then
  export AWS_DEFAULT_REGION="${S3_REGION}"
fi

BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-backups/postgres}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX#/}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
HOSTNAME_LABEL="$(hostname -s 2>/dev/null || echo ec2)"
OBJECT_KEY="${BACKUP_S3_PREFIX}/${POSTGRES_DB}-${HOSTNAME_LABEL}-${TIMESTAMP}.sql.gz"

cd "${INFRA_DIR}"

log "Checking S3 bucket s3://${S3_BUCKET}"
aws s3api head-bucket --bucket "${S3_BUCKET}" >/dev/null

log "Checking postgres container health"
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null

log "Creating compressed dump and uploading to s3://${S3_BUCKET}/${OBJECT_KEY}"
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
  | gzip -c \
  | aws s3 cp - "s3://${S3_BUCKET}/${OBJECT_KEY}"

SIZE_BYTES="$(aws s3api head-object --bucket "${S3_BUCKET}" --key "${OBJECT_KEY}" --query 'ContentLength' --output text)"
log "Backup uploaded successfully (${SIZE_BYTES} bytes)"

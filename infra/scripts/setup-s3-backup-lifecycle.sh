#!/usr/bin/env bash
# Configure AWS S3 lifecycle expiration for Postgres backups only.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${INFRA_DIR}/.env}"

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

BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-backups/postgres/}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX#/}"
[[ "${BACKUP_S3_PREFIX}" == */ ]] || BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX}/"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

TMP_RULE="$(mktemp)"
trap 'rm -f "${TMP_RULE}"' EXIT

cat > "${TMP_RULE}" <<EOF
{
  "Rules": [
    {
      "ID": "delete-postgres-backups-after-${BACKUP_RETENTION_DAYS}-days",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "${BACKUP_S3_PREFIX}"
      },
      "Expiration": {
        "Days": ${BACKUP_RETENTION_DAYS}
      }
    }
  ]
}
EOF

echo "Applying lifecycle rule to s3://${S3_BUCKET}/${BACKUP_S3_PREFIX}"
aws s3api put-bucket-lifecycle-configuration \
  --bucket "${S3_BUCKET}" \
  --lifecycle-configuration "file://${TMP_RULE}"

echo "Lifecycle rule applied: ${BACKUP_RETENTION_DAYS} day expiration for ${BACKUP_S3_PREFIX}"

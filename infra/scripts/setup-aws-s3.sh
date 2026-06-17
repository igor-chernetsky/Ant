#!/usr/bin/env bash
# Apply CORS and verify an AWS S3 bucket for browser presigned uploads.
# Usage:
#   export S3_BUCKET=ant1-backet
#   export S3_REGION=eu-central-1
#   ./scripts/setup-aws-s3.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CORS_FILE="${INFRA_DIR}/s3/cors-ant1-backet.json"

BUCKET="${S3_BUCKET:-ant1-backet}"
REGION="${S3_REGION:-eu-central-1}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required. Install AWS CLI v2 and configure credentials."
  exit 1
fi

if [[ ! -f "${CORS_FILE}" ]]; then
  echo "CORS file not found: ${CORS_FILE}"
  exit 1
fi

echo "Checking bucket s3://${BUCKET} in ${REGION}..."
if aws s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  echo "Bucket exists."
else
  echo "Creating bucket s3://${BUCKET}..."
  if [[ "${REGION}" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "${BUCKET}"
  else
    aws s3api create-bucket \
      --bucket "${BUCKET}" \
      --create-bucket-configuration "LocationConstraint=${REGION}"
  fi
fi

echo "Blocking public access (recommended)..."
aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "Applying CORS from ${CORS_FILE}..."
aws s3api put-bucket-cors \
  --bucket "${BUCKET}" \
  --cors-configuration "file://${CORS_FILE}"

echo "Enabling default bucket encryption..."
aws s3api put-bucket-encryption \
  --bucket "${BUCKET}" \
  --server-side-encryption-configuration '{
    "Rules": [{ "ApplyServerSideEncryptionByDefault": { "SSEAlgorithm": "AES256" } }]
  }'

echo "Done. Set on API container:"
echo "  S3_BUCKET=${BUCKET}"
echo "  S3_REGION=${REGION}"
echo "  S3_FORCE_PATH_STYLE=false"
echo "  # leave S3_ENDPOINT and S3_PUBLIC_ENDPOINT empty for AWS"

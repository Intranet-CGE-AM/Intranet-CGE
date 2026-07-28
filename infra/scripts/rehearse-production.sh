#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/intranet-cge-rehearsal.XXXXXX")
env_file="$work_dir/rehearsal.env"
backup_dir="$work_dir/backups"
project="intranet-cge-rehearsal-$$"
admin_email=admin-rehearsal@local.invalid
admin_password=Admin-Rehearsal-Password-2026
web_origin=http://127.0.0.1:18080

cat >"$env_file" <<EOF
POSTGRES_DB=intranet_cge
POSTGRES_USER=cge
POSTGRES_PASSWORD=rehearsal-postgres-password
DATABASE_URL=postgresql://cge:rehearsal-postgres-password@postgres:5432/intranet_cge
SESSION_SECRET=rehearsal-session-secret-at-least-32-characters
SESSION_TTL_HOURS=12
MINIO_ROOT_USER=rehearsal-minio-user
MINIO_ROOT_PASSWORD=rehearsal-minio-password
OBJECT_STORAGE_ENDPOINT=http://minio:9000
OBJECT_STORAGE_ACCESS_KEY=rehearsal-minio-user
OBJECT_STORAGE_SECRET_KEY=rehearsal-minio-password
OBJECT_STORAGE_BUCKET=intranet-cge
WEB_ORIGIN=$web_origin
WEB_BIND_ADDRESS=127.0.0.1
WEB_PORT=18080
BOOTSTRAP_ADMIN_EMAIL=$admin_email
BOOTSTRAP_ADMIN_PASSWORD=
EOF

export BACKUP_DIR="$backup_dir"
export COMPOSE_PROJECT_NAME="$project"
export ENV_FILE="$env_file"
compose="docker compose --env-file $env_file -f $repo_dir/docker-compose.production.yml"

cleanup() {
  $compose --profile tools down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$work_dir"
}
trap cleanup EXIT INT TERM

$compose up -d --build --wait
$compose run --rm -e BOOTSTRAP_ADMIN_PASSWORD="$admin_password" api \
  pnpm admin:bootstrap
$compose --profile tools run --rm object-client \
  'mc alias set cge "$OBJECT_STORAGE_ENDPOINT" "$OBJECT_STORAGE_ACCESS_KEY" "$OBJECT_STORAGE_SECRET_KEY" >/dev/null &&
   printf rehearsal | mc pipe "cge/$OBJECT_STORAGE_BUCKET/rehearsal/sentinel.txt" >/dev/null'

bundle=$("$repo_dir/infra/scripts/backup.sh")
"$repo_dir/infra/scripts/verify-backup.sh" "$bundle"
$compose --profile tools run --rm object-client \
  'mc alias set cge "$OBJECT_STORAGE_ENDPOINT" "$OBJECT_STORAGE_ACCESS_KEY" "$OBJECT_STORAGE_SECRET_KEY" >/dev/null &&
   mc rm "cge/$OBJECT_STORAGE_BUCKET/rehearsal/sentinel.txt" >/dev/null'

CONFIRM_RESTORE=replace-production-data "$repo_dir/infra/scripts/restore.sh" "$bundle"
curl --fail --silent "$web_origin/readyz" >/dev/null
curl --fail --silent \
  -H "Content-Type: application/json" \
  -H "Origin: $web_origin" \
  --data '{"email":"'"$admin_email"'","password":"'"$admin_password"'"}' \
  "$web_origin/api/auth/login" | grep -q "$admin_email"
$compose --profile tools run --rm object-client \
  'mc alias set cge "$OBJECT_STORAGE_ENDPOINT" "$OBJECT_STORAGE_ACCESS_KEY" "$OBJECT_STORAGE_SECRET_KEY" >/dev/null &&
   mc stat "cge/$OBJECT_STORAGE_BUCKET/rehearsal/sentinel.txt" >/dev/null'

printf 'production rehearsal passed: migration, readiness, backup, destructive restore, login and object restore\n'

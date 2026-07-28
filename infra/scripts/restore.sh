#!/bin/sh
set -eu

if [ "$#" -ne 1 ] || [ "${CONFIRM_RESTORE:-}" != "replace-production-data" ]; then
  echo "Usage: CONFIRM_RESTORE=replace-production-data $0 backup-directory" >&2
  exit 2
fi

bundle=$1
database_dump="$bundle/database.dump"
test -d "$bundle/objects"
test -s "$database_dump"
repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
env_file="${ENV_FILE:-$repo_dir/.env.production}"
backup_dir=$(CDPATH= cd -- "$(dirname -- "$bundle")" && pwd)
bundle_name=$(basename "$bundle")
compose="docker compose --env-file $env_file -f $repo_dir/docker-compose.production.yml"

"$repo_dir/infra/scripts/verify-backup.sh" "$bundle"
$compose exec -T postgres sh -c \
  'dropdb --if-exists --force -U "$POSTGRES_USER" "$POSTGRES_DB" &&
   createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
$compose exec -T postgres sh -c \
  'pg_restore --exit-on-error --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  <"$database_dump"
BACKUP_DIR="$backup_dir" $compose --profile tools run --rm object-client \
  'mc alias set cge "$OBJECT_STORAGE_ENDPOINT" "$OBJECT_STORAGE_ACCESS_KEY" "$OBJECT_STORAGE_SECRET_KEY" >/dev/null &&
   mc mirror --overwrite --remove "/backup/'"$bundle_name"'/objects" "cge/$OBJECT_STORAGE_BUCKET" >/dev/null'

$compose restart api
$compose up -d --wait api
$compose exec -T api wget -q -O - http://127.0.0.1:3000/readyz

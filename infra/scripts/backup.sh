#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
env_file="${ENV_FILE:-$repo_dir/.env.production}"
backup_dir="${BACKUP_DIR:-$repo_dir/backups}"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
bundle="$backup_dir/intranet-cge-$timestamp"
database_dump="$bundle/database.dump"
objects="$bundle/objects"
compose="docker compose --env-file $env_file -f $repo_dir/docker-compose.production.yml"

umask 077
mkdir -p "$objects"
$compose exec -T postgres sh -c \
  'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >"$database_dump"
BACKUP_DIR="$backup_dir" $compose --profile tools run --rm object-client \
  'mc alias set cge "$OBJECT_STORAGE_ENDPOINT" "$OBJECT_STORAGE_ACCESS_KEY" "$OBJECT_STORAGE_SECRET_KEY" >/dev/null &&
   mc mirror --overwrite "cge/$OBJECT_STORAGE_BUCKET" "/backup/'"$(basename "$bundle")"'/objects" >/dev/null'

test -s "$database_dump"
(
  cd "$bundle"
  find . -type f ! -name checksums.sha256 -print | sort |
    xargs shasum -a 256 >checksums.sha256
)
printf '%s\n' "$bundle"

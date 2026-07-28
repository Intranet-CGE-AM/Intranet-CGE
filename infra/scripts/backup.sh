#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
env_file="${ENV_FILE:-$repo_dir/.env.production}"
backup_dir="${BACKUP_DIR:-$repo_dir/backups}"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
output="$backup_dir/intranet-cge-$timestamp.dump"

mkdir -p "$backup_dir"
docker compose \
  --env-file "$env_file" \
  -f "$repo_dir/docker-compose.production.yml" \
  exec -T postgres sh -c \
  'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >"$output"

test -s "$output"
printf '%s\n' "$output"

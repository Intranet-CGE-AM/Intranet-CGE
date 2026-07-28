#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 backup.dump" >&2
  exit 2
fi

backup_file=$1
test -s "$backup_file"
repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
env_file="${ENV_FILE:-$repo_dir/.env.production}"
compose="docker compose --env-file $env_file -f $repo_dir/docker-compose.production.yml"
validation_db=intranet_cge_restore_check

cleanup() {
  $compose exec -T postgres sh -c \
    'dropdb --if-exists --force -U "$POSTGRES_USER" intranet_cge_restore_check' \
    >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
$compose exec -T postgres sh -c \
  'createdb -U "$POSTGRES_USER" intranet_cge_restore_check'
$compose exec -T postgres sh -c \
  'pg_restore --exit-on-error --no-owner -U "$POSTGRES_USER" -d intranet_cge_restore_check' \
  <"$backup_file"

table_count=$(
  $compose exec -T postgres sh -c \
    'psql -At -U "$POSTGRES_USER" -d intranet_cge_restore_check -c "select count(*) from pg_tables where schemaname = current_schema()"'
)
test "$table_count" -gt 0
printf 'restore verified: %s public tables\n' "$table_count"

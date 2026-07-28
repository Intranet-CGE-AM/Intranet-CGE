#!/bin/sh
set -eu

if [ "$#" -ne 1 ] || [ "${CONFIRM_RESTORE:-}" != "replace-production-database" ]; then
  echo "Usage: CONFIRM_RESTORE=replace-production-database $0 backup.dump" >&2
  exit 2
fi

backup_file=$1
test -s "$backup_file"
repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
env_file="${ENV_FILE:-$repo_dir/.env.production}"
compose="docker compose --env-file $env_file -f $repo_dir/docker-compose.production.yml"

$compose exec -T postgres sh -c \
  'dropdb --if-exists --force -U "$POSTGRES_USER" "$POSTGRES_DB" &&
   createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
$compose exec -T postgres sh -c \
  'pg_restore --exit-on-error --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  <"$backup_file"

$compose restart api
$compose exec -T api wget -q -O - http://127.0.0.1:3000/readyz

#!/bin/sh
# Decide se as migrações rodam antes de iniciar a API.
#
# A mesma imagem é promovida de homologação para produção, então o
# comportamento vem do ambiente, nunca do build.
#
#   RUN_MIGRATIONS=true   aplica as migrações pendentes e sobe a API
#   RUN_MIGRATIONS=false  sobe a API sem tocar no schema (padrão)
#
# Em produção o pedido explícito ainda exige MIGRATION_CONFIRM, no mesmo
# formato usado por HOMOLOG_SEED_CONFIRM no seed de homologação.
set -eu

migration_confirmation="MIGRATE_CGE_PROD"

if [ "${RUN_MIGRATIONS:-false}" != "true" ]; then
  echo '{"level":"info","msg":"migrations skipped","run_migrations":"false"}'
elif [ "${NODE_ENV:-}" = "production" ] &&
  [ "${MIGRATION_CONFIRM:-}" != "$migration_confirmation" ]; then
  echo '{"level":"error","msg":"migrations refused in production","hint":"set MIGRATION_CONFIRM='"$migration_confirmation"'"}' >&2
  exit 1
else
  echo '{"level":"info","msg":"applying migrations"}'
  pnpm --filter @cge/api db:migrate
fi

exec pnpm --filter @cge/api start

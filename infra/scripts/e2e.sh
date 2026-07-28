#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
database_url=postgresql://cge:cge@127.0.0.1:5432/intranet_cge_e2e
admin_email=admin-e2e@local.invalid
admin_password=Admin-E2E-Password-123

cd "$repo_dir"
docker compose up -d --wait postgres

cleanup() {
  docker compose exec -T postgres sh -c \
    'dropdb --if-exists --force -U "$POSTGRES_USER" intranet_cge_e2e' \
    >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

cleanup
docker compose exec -T postgres sh -c \
  'createdb -U "$POSTGRES_USER" intranet_cge_e2e'

DATABASE_URL=$database_url pnpm --filter @cge/api db:migrate
NODE_ENV=test \
DATABASE_URL=$database_url \
BOOTSTRAP_ADMIN_EMAIL=$admin_email \
BOOTSTRAP_ADMIN_PASSWORD=$admin_password \
pnpm admin:bootstrap
NODE_ENV=test \
DATABASE_URL=$database_url \
BOOTSTRAP_ADMIN_EMAIL=$admin_email \
pnpm --filter @cge/api exec tsx src/scripts/prepare-e2e.ts
NODE_ENV=test \
DATABASE_URL=$database_url \
HOMOLOG_SEED_CONFIRM=SEED_CGE_HOMOLOG \
HOMOLOG_SEED_PASSWORD=Homolog-Password-2026 \
pnpm homolog:seed

pnpm exec playwright test "$@"

#!/bin/sh
set -eu
repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_dir"
pnpm --filter @cge/contracts build
docker compose up -d --wait postgres
name="intranet_cge_ad_test_$$"
docker compose exec -T postgres createdb -U cge "$name"
cleanup() {
  docker compose exec -T postgres dropdb --if-exists --force -U cge "$name" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM
database_url="postgresql://cge:cge@127.0.0.1:5432/$name"
DATABASE_URL="$database_url" pnpm --filter @cge/api db:migrate
CGE_AUTH_TEST_DATABASE_URL="$database_url" pnpm --filter @cge/api exec vitest run src/modules/auth/directory.integration.test.ts
pnpm exec playwright test --config tests/ad/playwright.config.ts

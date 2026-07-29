#!/bin/sh
# Recusa migrações que apaguem ou sobrescrevam dados existentes.
#
# A API de produção nunca migra ao subir, mas homologação migra sozinha e a
# mesma migração acaba aplicada em produção mais tarde. O runtime não sabe
# distinguir `ADD COLUMN` de `DROP COLUMN`; o CI sabe, e é aqui que a regra
# vale: nenhuma migração destrutiva entra na base.
#
# Uso: ./infra/scripts/check-migrations.sh [diretorio]
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
migrations_dir="${1:-$repo_dir/apps/api/drizzle}"

# Statements que removem dados, removem estruturas que guardam dados, ou
# rejeitam linhas já gravadas.
destructive='DROP[[:space:]]+(TABLE|COLUMN|CONSTRAINT|INDEX|TYPE|SCHEMA|DATABASE)|TRUNCATE|DELETE[[:space:]]+FROM|ALTER[[:space:]]+COLUMN|SET[[:space:]]+NOT[[:space:]]+NULL|RENAME[[:space:]]+(TO|COLUMN)'

if [ ! -d "$migrations_dir" ]; then
  echo "Diretório de migrações não encontrado: $migrations_dir" >&2
  exit 1
fi

found=$(
  find "$migrations_dir" -name '*.sql' -type f -print0 |
    xargs -0 grep -HniE "$destructive" 2>/dev/null || true
)

if [ -n "$found" ]; then
  echo "Migração destrutiva rejeitada:" >&2
  echo "$found" >&2
  cat >&2 <<'EOF'

Nenhuma migração pode apagar ou sobrescrever dados existentes.
Para evoluir o schema sem perda:

  - adicione coluna nova aceitando NULL em vez de alterar a existente;
  - crie a estrutura nova, migre os dados e deixe a antiga parada;
  - trate a remoção como operação de manutenção fora do ciclo de deploy.
EOF
  exit 1
fi

count=$(find "$migrations_dir" -name '*.sql' -type f | wc -l | tr -d ' ')
echo "$count migrações verificadas, nenhuma destrutiva."

# Integração e entrega contínuas

## Dois ambientes, uma imagem

`dev` e `main` são branches de longa duração. Cada uma governa um ambiente.

| Branch | Ambiente    | Tag da imagem | Migrações      | Cookie `Secure` |
| ------ | ----------- | ------------- | -------------- | --------------- |
| `dev`  | homologação | `homolog`     | automáticas    | não             |
| `main` | produção    | `production`  | nunca ao subir | sim             |

Os dois ambientes rodam **a mesma imagem**. O que muda é o ambiente de
execução, nunca o build. É isso que permite afirmar que o que entra em produção
é exatamente o que foi validado em homologação.

O front-end não embute endereço no build: o `web` chama `/api` no mesmo host e
o nginx da própria imagem encaminha para a `api`. Uma imagem serve os dois
ambientes sem recompilação.

## Fluxo

```
pull request  ──► CI: migrações, formato, lint, tipos, testes, build, e2e
                   │
merge em dev  ──► CI ──► publica ghcr :homolog e :tree-<árvore>
                          └─► Watchtower de homologação puxa em até 2 min
                   │
merge em main ──► CI ──► exige :tree-<árvore> já publicada
                          └─► reaponta :production para o mesmo digest
                               └─► Watchtower de produção puxa em até 5 min
```

Nenhuma imagem é reconstruída na promoção. `main` apenas reaponta a tag
`production` para o digest que já rodou em homologação.

### Por que a árvore do Git e não o commit

Um merge de `dev` para `main` sem alterações produz um commit novo, com hash
diferente, mas a **mesma árvore de arquivos**. Marcar a imagem com
`git rev-parse HEAD^{tree}` faz `main` reencontrar exatamente o artefato de
`dev`.

Se a árvore de `main` nunca passou por `dev`, o job de promoção falha em vez de
publicar algo não homologado. Commit direto em `main` não chega em produção.

## Migrações

A imagem decide migrar pelo ambiente, não pelo build
(`infra/api-entrypoint.sh`):

| `RUN_MIGRATIONS` | `NODE_ENV`   | `MIGRATION_CONFIRM` | Resultado          |
| ---------------- | ------------ | ------------------- | ------------------ |
| ausente ou falso | qualquer     | —                   | sobe sem migrar    |
| `true`           | ≠ production | —                   | migra e sobe       |
| `true`           | production   | ausente             | **recusa e sai 1** |
| `true`           | production   | `MIGRATE_CGE_PROD`  | migra e sobe       |

Produção sobe com `RUN_MIGRATIONS=false`. Um restart do Watchtower nunca toca
no schema.

Quando produção precisar de schema novo, a migração é operação deliberada:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml \
  run --rm \
  -e RUN_MIGRATIONS=true \
  -e MIGRATION_CONFIRM=MIGRATE_CGE_PROD \
  api pnpm --filter @cge/api db:migrate
```

### Migrações não podem destruir dados

`infra/scripts/check-migrations.sh` roda no CI e reprova o pull request quando
uma migração contém `DROP`, `TRUNCATE`, `DELETE FROM`, `ALTER COLUMN`,
`SET NOT NULL` ou `RENAME`. O runtime não distingue uma migração aditiva de uma
destrutiva; o CI distingue, e a regra vale ali.

Para evoluir o schema sem perda: adicione coluna nova aceitando `NULL`, crie a
estrutura nova e migre os dados, e trate remoção como manutenção fora do ciclo
de deploy.

## Watchtower

Cada ambiente roda a própria instância, separada por escopo
(`WATCHTOWER_SCOPE`). Um container só é atualizado se carregar o rótulo
`com.centurylinklabs.watchtower.scope` correspondente.

Só `api` e `web` têm o rótulo. **`postgres` e `minio` nunca são reiniciados
pelo Watchtower** — serviços com estado ficam fora, de propósito.

O Watchtower consulta o GHCR por polling. A máquina só precisa de saída HTTPS;
nenhuma porta de entrada é aberta para o GitHub, e nada depende de a VPN estar
alcançável de fora.

Ele autentica no GHCR pelo `config.json` montado do host. Na máquina:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u <usuario> --password-stdin
```

O token precisa apenas de `read:packages`.

## Homologação sem TLS

Homologação é acessada por IP e porta, sem proxy TLS. O cookie de sessão é
`HttpOnly` e `SameSite=Strict` nos dois ambientes, mas `Secure` só em produção
— com `Secure` em HTTP o navegador não devolveria o cookie e o login nunca
completaria.

`SECURE_COOKIES=false` vale **somente** em homologação, onde a rede é fechada e
os dados vêm do seed. Produção mantém `SECURE_COOKIES=true` e exige HTTPS.

`WEB_ORIGIN` precisa bater exatamente com o endereço digitado no navegador,
porta incluída. A API rejeita escritas de outra origem.

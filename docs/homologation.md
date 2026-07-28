# Homologação

O seed de homologação existe para validar telas, permissões e estados sem usar
dados reais. Ele é idempotente para os registros com matrícula `HOM-*`.

## Proteções

O comando recusa execução quando:

- `NODE_ENV=production`;
- o nome do banco não contém `homolog`, `hml`, `test` ou `e2e`;
- `HOMOLOG_SEED_CONFIRM` não é `SEED_CGE_HOMOLOG`;
- a senha comum possui menos de 12 caracteres.

## Execução

```bash
NODE_ENV=development \
DATABASE_URL=postgresql://cge:cge@localhost:5432/intranet_cge_homolog \
HOMOLOG_SEED_CONFIRM=SEED_CGE_HOMOLOG \
HOMOLOG_SEED_PASSWORD='defina-uma-senha-temporaria-forte' \
pnpm homolog:seed
```

O banco deve estar migrado antes da execução.

## Cenários criados

- 7 pessoas ativas, incluindo nome e cargo longos;
- aniversário hoje, amanhã, futuro e opt-out;
- categoria elegível e categoria não elegível a férias;
- contas de RH, chefia, colaborador, consulta, terceirizado e desativada;
- papéis globais e restritos por unidade;
- solicitações nos 7 estados do fluxo de férias;
- eventos imutáveis e registros de auditoria.

As contas ativas usam o valor de `HOMOLOG_SEED_PASSWORD`. O comando imprime os
e-mails disponíveis, mas nunca imprime a senha.

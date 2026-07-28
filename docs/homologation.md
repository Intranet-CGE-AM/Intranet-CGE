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

- 10 pessoas, incluindo nome e cargo longos e vínculo encerrado;
- aniversário hoje, amanhã, futuro e opt-out;
- categoria elegível e categoria não elegível a férias;
- conta sem acesso a módulos, conta desativada e primeiro acesso obrigatório;
- papéis globais, restritos por unidade e múltiplos papéis na mesma conta;
- unidade vazia para validar escopos sem resultados;
- solicitações nos 7 estados do fluxo de férias;
- eventos imutáveis e registros de auditoria com sucesso e falha.

As contas ativas usam o valor de `HOMOLOG_SEED_PASSWORD`. O comando imprime os
e-mails disponíveis, mas nunca imprime a senha.

## Personas de validação

| Conta                                   | Estado principal                                           |
| --------------------------------------- | ---------------------------------------------------------- |
| `marina.rocha@homolog.cge.am.gov.br`    | Gestão de pessoas e decisão final                          |
| `helena.monteiro@homolog.cge.am.gov.br` | Chefia com escopo de unidade                               |
| `caio.nascimento@homolog.cge.am.gov.br` | Todos os estados do fluxo de férias                        |
| `leonardo.araujo@homolog.cge.am.gov.br` | Diretório limitado por unidade e aniversário oculto        |
| `dandara.ribeiro@homolog.cge.am.gov.br` | Categoria não elegível a férias                            |
| `patricia.mota@homolog.cge.am.gov.br`   | Conta desativada                                           |
| `ana.vasconcelos@homolog.cge.am.gov.br` | Conta ativa sem acesso a módulos                           |
| `luiza.barreto@homolog.cge.am.gov.br`   | Primeiro acesso, sem chefia e com papéis em RH e auditoria |
| `thiago.freitas@homolog.cge.am.gov.br`  | Diretório com escopo autorizado vazio                      |
| `renata.martins@homolog.cge.am.gov.br`  | Conta ativa com vínculo funcional encerrado                |

## Estados que não pertencem ao seed

Estados transitórios não são persistidos artificialmente no banco. Os testes
Playwright reproduzem carregamento, validação de formulário, CSV inválido,
concorrência desatualizada, foco, responsividade e falhas de autorização sobre
os mesmos dados de homologação.

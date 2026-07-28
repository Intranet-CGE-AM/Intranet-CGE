# Intranet CGE

Monorepo da intranet modular da Controladoria-Geral do Estado do Amazonas.
O v1 entrega autenticação local, administração de contas e papéis, diretório
funcional, aniversários autorizados, importação CSV auditável e fluxo de férias
com decisão da chefia e validação final.

## Estrutura

```text
apps/
  web/          React + Vite
  api/          Fastify + PostgreSQL
packages/
  ui/           componentes, estados e tokens visuais compartilhados
  contracts/    schemas Zod, tipos de API e catálogo de permissões
infra/          imagens, proxy, backup, restauração e testes E2E
legacy/         protótipo estático preservado
.scratch/       mapa e decisões do Wayfinder
```

Não há framework de plugins em runtime. Um módulo é uma rota vertical da API,
uma página do web app e permissões explícitas no catálogo compartilhado.

## Desenvolvimento

Requisitos: Node.js 22.22 ou superior, pnpm 10 e Docker.

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres minio
pnpm --filter @cge/api db:migrate
pnpm dev
```

Web: `http://localhost:5173`. API: `http://localhost:3000`.

Para provisionar a primeira conta, preencha temporariamente
`BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` em `.env` e execute:

```bash
pnpm admin:bootstrap
```

O bootstrap é idempotente e exige troca da senha no primeiro acesso.

## Qualidade

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm test:e2e` cria e remove apenas o banco `intranet_cge_e2e`. O fluxo real
testado importa pessoas, cria contas e papéis, troca senhas temporárias,
solicita férias, aprova nas duas etapas, valida avatares privados no MinIO e
confirma o CSV de auditoria.

## Documentação

- [Administração](docs/administration.md)
- [Contrato da importação CSV](docs/csv-import.md)
- [Design system](docs/design-system.md)
- [Homologação e dados de teste](docs/homologation.md)
- [Implantação, backup e restauração](docs/deployment.md)
- [Prontidão para UAT e piloto](docs/pilot-readiness.md)

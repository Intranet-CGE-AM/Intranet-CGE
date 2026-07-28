# Administração da plataforma

## Primeiro acesso

O bootstrap cria uma pessoa, uma conta e o papel global
`Administrador da plataforma`. A senha deve ter pelo menos 12 caracteres e é
obrigatoriamente substituída no primeiro acesso.

Em produção:

```bash
docker compose --env-file .env.production \
  -f docker-compose.production.yml run --rm api pnpm admin:bootstrap
```

Depois do primeiro acesso, remova `BOOTSTRAP_ADMIN_PASSWORD` do arquivo de
ambiente. O script pode ser executado novamente para reconciliar o catálogo de
permissões do papel administrador.

## Contas, papéis e escopos

Uma conta sempre pertence a uma pessoa previamente cadastrada. Uma conta pode
acumular vários papéis:

- global: a permissão vale para toda a plataforma;
- por unidade: a permissão vale somente para a unidade atribuída.

As permissões dos papéis são aditivas. Alterações entram em vigor na próxima
requisição; não é necessário recriar a conta ou emitir uma nova senha.

O catálogo de permissões é fixo no código:

| Permissão                     | Uso                                                  |
| ----------------------------- | ---------------------------------------------------- |
| `accounts.manage`             | criar, redefinir senha e desativar contas            |
| `access.manage`               | criar papéis e atribuir escopos                      |
| `people.read`                 | consultar o diretório                                |
| `people.manage`               | administrar pessoas, vínculos, categorias e unidades |
| `people.import`               | validar e aplicar CSV                                |
| `birthdays.read`              | consultar dia e mês autorizados                      |
| `vacations.create`            | solicitar e cancelar férias                          |
| `vacations.review.supervisor` | decidir como chefia explícita                        |
| `vacations.review.final`      | validar na etapa final                               |
| `audit.read`                  | consultar eventos                                    |
| `audit.export`                | exportar eventos em CSV                              |

O backend é a autoridade final. Esconder uma ação na interface nunca substitui
a verificação de permissão e unidade na API.

## Pessoas e férias

Antes de cadastrar vínculos manualmente, crie ao menos uma categoria e uma
unidade em **Colaboradores → Categorias e unidades**. Categorias devem ser
marcadas como elegíveis para habilitar o fluxo de férias.

Cada trabalhador que solicita férias precisa de uma chefia explícita, definida
na ação **Definir chefia**. A solicitação guarda essa relação no envio para que
uma troca posterior de chefia não altere silenciosamente o responsável
original.

A intranet não calcula saldo ou direito de férias. A etapa final registra a
validação feita no processo de pessoal oficial.

## Fotos de colaboradores

Quem possui `people.manage` pode enviar ou remover a foto de pessoas dentro do
seu escopo. A API aceita JPEG, PNG e WebP de até 2 MB, remove metadados e
normaliza o conteúdo para WebP quadrado de 512 px. Os objetos ficam privados e
só são entregues pela API após verificar sessão e escopo.

## Desativação e auditoria

Desativar uma pessoa encerra o vínculo ativo, desativa sua conta e revoga as
sessões. Redefinir uma senha também revoga sessões e exige nova troca no
primeiro acesso.

Eventos de login, contas, papéis, pessoas, fotos, importações e decisões de
férias são append-only e exportáveis em `/api/audit-events/export`.

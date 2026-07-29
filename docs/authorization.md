# Autorização

## Regra de segurança

A API é a autoridade final. A interface esconde módulos, rotas e operações não
autorizadas para evitar caminhos sem saída, mas nenhuma decisão do navegador
substitui `requirePermission`.

O modelo usa um catálogo fixo de permissões, papéis editáveis e atribuições
aditivas. Cada atribuição vale para toda a organização ou para uma unidade
organizacional. CASL não é usado porque as condições atuais são somente
permissão + escopo global/unidade.

## Interface compartilhada

- `packages/contracts/src/access.ts` define chaves, escopos permitidos e a
  avaliação pura de permissões;
- `apps/web/src/lib/permissions.ts` adapta essa avaliação para o usuário
  autenticado;
- `apps/web/src/navigation.ts` declara uma única regra por módulo e rota;
- `RequireAccess` impede acesso por URL direta;
- `requirePermission` valida sessão, troca obrigatória de senha, permissão e
  unidade na API.

Permissões de plataforma e operações sem unidade, como contas, papéis,
auditoria e importação CSV, aceitam somente atribuição global. A interface
desabilita a escolha de unidade e a API rejeita atribuições incompatíveis.

## Como adicionar um módulo

1. Adicione as chaves ao catálogo e declare se aceitam escopo por unidade.
2. Declare a regra do módulo e de cada rota em `navigation.ts`.
3. Proteja a rota React com `RequireAccess`.
4. Use `can`, `canGlobally` ou `can(..., unitId)` para ocultar cada operação.
5. Proteja todo endpoint com `requirePermission`; derive `unitId` do recurso no
   servidor, nunca do navegador.
6. Em transferências, valide o escopo de origem e o de destino.
7. Adicione testes para ausência de permissão, permissão global, unidade
   correta, unidade incorreta e URL direta.

## Matriz mínima de aceite

| Caso                         | Interface                      | API                     |
| ---------------------------- | ------------------------------ | ----------------------- |
| Sem permissão                | módulo, rota e ação invisíveis | `403 FORBIDDEN`         |
| Permissão global             | acesso disponível              | operação autorizada     |
| Unidade correta              | ação disponível no recurso     | operação autorizada     |
| Unidade incorreta            | ação ausente                   | `403 FORBIDDEN`         |
| Permissão global por unidade | unidade desabilitada           | atribuição rejeitada    |
| Permissão revogada           | atualiza ao retomar a janela   | vale na próxima chamada |

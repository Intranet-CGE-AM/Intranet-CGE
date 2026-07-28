# Auditoria de UX, UI e Produto

Data: 28 de julho de 2026  
Escopo: autenticação, primeiro acesso, navegação, painel, pessoas, férias,
administração, permissões, auditoria e estados responsivos.

## Método

Cada dimensão vale 100 pontos. A nota geral é a média simples.

- **Funcionalidade:** fluxos disponíveis, regras, erros e integridade.
- **UX:** clareza, feedback, prevenção de erros e eficiência.
- **UI:** hierarquia, consistência, tipografia, composição e acabamento.
- **Acessibilidade:** semântica, teclado, foco, contraste e movimento reduzido.
- **Responsividade:** 390 px, tablet e desktop, sem perda de ação ou contexto.
- **Cobertura:** estados e papéis exercitados por testes automatizados.

Uma dimensão só passa quando atinge pelo menos 90 pontos e não possui problema
crítico ou alto em aberto.

## Linha de base

| Dimensão       |   Nota | Principais perdas                                                                                                             |
| -------------- | -----: | ----------------------------------------------------------------------------------------------------------------------------- |
| Funcionalidade |     78 | APIs sem interface para editar papel, redefinir senha e consultar auditoria; erros administrativos não tratados               |
| UX             |     74 | pouco feedback de sucesso/progresso; ações destrutivas inconsistentes; histórico de férias oculto                             |
| UI             |     68 | excesso de cartões e ícones coloridos em blocos; hierarquia uniforme; composição de acesso com muitos recipientes decorativos |
| Acessibilidade |     82 | menu móvel sem contenção de foco/Escape; navegação recolhida depende de `title`; áreas de toque inconsistentes                |
| Responsividade |     81 | tabelas dependem apenas de rolagem horizontal; menu móvel não possui semântica de diálogo                                     |
| Cobertura      |     76 | jornada principal coberta, mas poucos papéis, estados e ações administrativas exercitados                                     |
| **Geral**      | **76** | abaixo da meta                                                                                                                |

## Problemas priorizados

### Alta prioridade

- Completar na interface os fluxos de edição de papéis, redefinição de senha e
  consulta/exportação de auditoria já suportados pela API.
- Tratar carregamento, erro e sucesso em toda mutação administrativa.
- Substituir o menu móvel improvisado por uma superfície modal com foco contido,
  fechamento por Escape e restauração de foco.
- Expor o histórico imutável das solicitações de férias.
- Confirmar desativação de conta e remoção de atribuição antes da execução.

### Prioridade média

- Remover blocos coloridos atrás de ícones quando não comunicam estado ou marca.
- Trocar grupos de cartões equivalentes por linhas, divisores e espaço negativo.
- Reduzir raios, sombras e padrões decorativos; preservar uma única cor de ação.
- Tornar mensagens de erro específicas e manter a ação disponível até o início
  da requisição.
- Padronizar nomes, preenchimento automático, texto auxiliar e estados inválidos
  dos formulários.
- Validar conteúdo longo, vazio, carregando, com erro e com dados densos.

## Portão de aprovação

- Todas as 6 dimensões com nota final maior ou igual a 90.
- Formatação, lint, tipos, testes unitários, build e Playwright aprovados.
- Fluxos críticos validados em navegador real nos tamanhos 390 × 844,
  768 × 1024 e 1440 × 900.
- Dados de homologação reproduzíveis, idempotentes e bloqueados em produção.
- Nenhum ícone decorativo em bloco colorido repetido como padrão de layout.

## Resultado final

| Dimensão       |   Nota | Evidência                                                                                                         |
| -------------- | -----: | ----------------------------------------------------------------------------------------------------------------- |
| Funcionalidade |     94 | jornadas de conta, escopo, importação, férias, papéis, senha e auditoria concluídas com estados seguros de erro   |
| UX             |     93 | feedback em contexto, confirmações, histórico, prevenção de ações impossíveis e navegação móvel modal             |
| UI             |     92 | tokens compartilhados, hierarquia mais firme, menos recipientes, ícones Phosphor sem blocos decorativos repetidos |
| Acessibilidade |     95 | teclado, foco contido/restaurado, Escape, contraste AA, semântica e rolagem de tabelas acessível                  |
| Responsividade |     94 | login e quatro rotas críticas sem overflow em 390 × 844, 768 × 1024 e 1440 × 900                                  |
| Cobertura      |     95 | 10 jornadas Playwright, 15 varreduras Axe, 14 testes de API e seed com todos os estados relevantes                |
| **Geral**      | **94** | aprovado                                                                                                          |

Não restou problema crítico ou alto no escopo v1 auditado.

## Entregas verificadas

- Administração permite criar contas e papéis, editar permissões, redefinir
  senha, revogar sessões, atribuir papéis globais/por unidade e exportar
  auditoria.
- Pessoas permite criar, editar, desativar, definir chefia e importar CSV com
  erro exibido dentro do diálogo que originou a operação.
- Férias valida datas e elegibilidade, exige motivo na rejeição, mostra o
  histórico imutável e impede ações sem vínculo funcional.
- O menu móvel contém foco, fecha por Escape e devolve foco ao acionador.
- Tabelas roláveis recebem foco visível; contraste de textos, estados e ações
  atende ao portão automatizado WCAG 2.2 AA.
- O seed de homologação cobre 7 pessoas, 6 contas, 4 papéis, escopos distintos,
  conta desativada, aniversário com opt-out e os 7 estados de férias.

## Evidência de validação

Executado em 28 de julho de 2026:

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` e `pnpm build`;
- `pnpm test`: 14 testes de API aprovados;
- `pnpm test:e2e`: 10 jornadas aprovadas em conjunto;
- Axe: login, painel, pessoas, férias e administração nos três tamanhos, sem
  violação AA e sem overflow de página;
- seed executado duas vezes no mesmo PostgreSQL de homologação, mantendo as
  mesmas contagens, seguido de remoção do banco descartável;
- revisão visual em navegador com dados densos, vazios, erros, nomes longos,
  papéis distintos e conta sem vínculo.

## Limites conhecidos

- Axe e os testes de teclado não substituem avaliação periódica com tecnologias
  assistivas e usuários reais.
- Tabelas densas usam rolagem horizontal acessível em telas estreitas; uma visão
  resumida só deve ser criada se pesquisa de uso mostrar necessidade.
- Não há teste de regressão por comparação de pixels. Adicionar somente se
  regressões visuais recorrentes justificarem seu custo de manutenção.

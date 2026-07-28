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

Será preenchido após a implementação e a validação completa.
